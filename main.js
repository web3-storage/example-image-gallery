import './style.css'
import { Web3Storage } from 'web3.storage'
import Glide from '@glidejs/glide'

const previewImage = document.getElementById('image-preview')
const uploadButton = document.getElementById('upload-button')
const fileInput = document.getElementById('file-input')
const dropArea = document.getElementById('drop-area')
const captionInput = document.getElementById('caption-input')
const output = document.getElementById('output')
const tokenInput = document.getElementById('token-input')

////////////////////////////////
////// Image upload & listing
////////////////////////////////

// #region web3storage-interactions

// We use this to identify our uploads in the client.list response.
const namePrefix = 'ImageGallery'

/**
 * Stores an image file on Web3.Storage, along with a small metadata.json that includes a caption & filename.
 * @param {File} imageFile a File object containing image data
 * @param {string} caption a string that describes the image
 * 
 * @typedef StoreImageResult
 * @property {string} cid the Content ID for an directory containing the image and metadata
 * @property {string} imageURI an ipfs:// URI for the image file
 * @property {string} metadataURI an ipfs:// URI for the metadata file
 * @property {string} imageGatewayURL an HTTP gateway URL for the image
 * @property {string} metadataGatewayURL an HTTP gateway URL for the metadata file
 * 
 * @returns {Promise<StoreImageResult>} an object containing links to the uploaded content
 */
async function storeImage(imageFile, caption) {
  // The name for our upload includes a prefix we can use to identify our files later
  const uploadName = [namePrefix, caption].join('|')

  // We store some metadata about the image alongside the image file.
  // The metadata includes the file path, which we can use to generate 
  // a URL to the full image.
  const metadataFile = jsonFile('metadata.json', {
    path: imageFile.name,
    caption
  })

  const token = getSavedToken()
  if (!token) {
    showMessage('> ❗️ no API token found for Web3.Storage. You can add one in the settings page!')
    showLink(`${location.protocol}//${location.host}/settings.html`)
    return
  }
  const web3storage = new Web3Storage({ token })
  showMessage(`> 🤖 calculating content ID for ${imageFile.name}`)
  const cid = await web3storage.put([imageFile, metadataFile], {
    // the name is viewable at https://web3.storage/files and is included in the status and list API responses
    name: uploadName,

    // onRootCidReady will be called as soon as we've calculated the Content ID locally, before uploading
    onRootCidReady: (localCid) => {
      showMessage(`> 🔑 locally calculated Content ID: ${localCid} `)
      showMessage('> 📡 sending files to web3.storage ')
    },

    // onStoredChunk is called after each chunk of data is uploaded
    onStoredChunk: (bytes) => showMessage(`> 🛰 sent ${bytes.toLocaleString()} bytes to web3.storage`)
  })

  const metadataGatewayURL = makeGatewayURL(cid, 'metadata.json')
  const imageGatewayURL = makeGatewayURL(cid, imageFile.name)
  const imageURI = `ipfs://${cid}/${imageFile.name}`
  const metadataURI = `ipfs://${cid}/metadata.json`
  return { cid, metadataGatewayURL, imageGatewayURL, imageURI, metadataURI }
}


/**
 * Get metadata objects for each image stored in the gallery.
 * 
 * @returns {AsyncIterator<ImageMetadata>} an async iterator that will yield an ImageMetadata object for each stored image.
 */
async function* listImageMetadata() {
  const token = getSavedToken()
  if (!token) {
    console.error('No API token for Web3.Storage found.')
    return
  }

  const web3storage = new Web3Storage({ token })
  for await (const upload of web3storage.list()) {
    if (!upload.name || !upload.name.startsWith(namePrefix)) {
      continue
    }

    try {
      const metadata = await getImageMetadata(upload.cid)
      yield metadata
    } catch (e) {
      console.error('error getting image metadata:', e)
      continue
    }
  }
}

/**
 * Fetches the metadata JSON from an image upload.
 * @param {string} cid the CID for the IPFS directory containing the metadata & image
 * 
 * @typedef {object} ImageMetadata
 * @property {string} cid the root cid of the IPFS directory containing the image & metadata
 * @property {string} path the path within the IPFS directory to the image file
 * @property {string} caption a user-provided caption for the image
 * @property {string} gatewayURL an IPFS gateway url for the image
 * @property {string} uri an IPFS uri for the image
 * 
 * @returns {Promise<ImageMetadata>} a promise that resolves to a metadata object for the image
 */
async function getImageMetadata(cid) {
  const url = makeGatewayURL(cid, 'metadata.json')
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`error fetching image metadata: [${res.status}] ${res.statusText}`)
  }
  const metadata = await res.json()
  const gatewayURL = makeGatewayURL(cid, metadata.path)
  const uri = `ipfs://${cid}/${metadata.path}`
  return { ...metadata, cid, gatewayURL, uri }
}

// #endregion web3storage-interactions

////////////////////////////////
////// Upload view
////////////////////////////////

// #region upload-view

// keep track of currently selected file
let selectedFile = null

/**
 * DOM initialization for upload UI.
 */
function setupUploadUI() {
  if (!document.getElementById('upload-ui')) {
    return
  }

  // handle file selection changes
  fileInput.onchange = fileSelected

  // handle upload button clicks
  uploadButton.onclick = uploadClicked

  // apply highlight class when user drags over the drop-area div
  for (const eventName of ['dragenter', 'dragover']) {
    const highlight = e => {
      e.preventDefault()
      dropArea.classList.add('highlight')
    }
    dropArea.addEventListener(eventName, highlight, false)
  }

  // remove highlight class on drag exit
  for (const eventName of ['dragleave', 'drop']) {
    const unhighlight = e => {
      e.preventDefault()
      dropArea.classList.remove('highlight')
    }
    dropArea.addEventListener(eventName, unhighlight, false)
  }

  // handle dropped files
  dropArea.addEventListener('drop', fileDropped, false)
}

/**
 * Callback for file input onchange event, fired when the user makes a file selection.
 */
function fileSelected(e) {
  if (e.target.files.length < 1) {
    console.log('nothing selected')
    return
  }
  handleFileSelected(e.target.files[0])
}

/**
 * Callback for 'drop' event that fires when user drops a file onto the drop-area div.
 */
function fileDropped(evt) {
  evt.preventDefault()
  
  // filter out any non-image files
  const files = [...evt.dataTransfer.files].filter(f => f.type.includes('image'))
  if (files.length < 1) {
    console.log('drop handler recieved no image files, ignoring drop event')
    return
  }
  handleFileSelected(files[0])
}

/**
 * Respond to file selection, whether through drag-and-drop or manual selection.
 * Side effects: sets preview image to file content and sets upload button state to enabled.
 */
function handleFileSelected(file) {
  selectedFile = file
  if (file == null) {
    uploadButton.disabled = true
    return
  }
  updatePreviewImages(file)
  uploadButton.disabled = false
}

function updatePreviewImages(imageFile) {
  const elements = document.querySelectorAll('img.preview-image')
  const url = URL.createObjectURL(imageFile)
  for (const img of elements) {
    img.src = url
  }
}

/**
 * Callback for upload button's onclick event. Calls storeImage with user selected file and caption text.
 * @param {Event} evt 
 * @returns 
 */
function uploadClicked(evt) {
  evt.preventDefault()
  if (selectedFile == null) {
    console.log('no file selected')
    return
  }

  // switch to "upload in progress" view
  showInProgressUI()

  const caption = captionInput.value || ''
  storeImage(selectedFile, caption).then(({ cid, imageGatewayURL, imageURI, metadataGatewayURL, metadataURI }) => {
    // TODO: do something with the cid (generate sharing link, etc)
    showMessage(`stored image with cid: ${cid}`)
    showMessage(`ipfs image uri: ${imageURI}`)
    showLink(metadataGatewayURL)
    showMessage(`ipfs metadata uri: ${metadataURI}`)
    showLink(imageGatewayURL)
  })
}

/**
 * Hides the file upload view and shows an "upload in progress" view.
 */
function showInProgressUI() {
  const container = document.getElementById('upload-in-progress')
  // the upload-in-progress element uses 'display: flex', which doesn't play well
  // with the "hidden" attribute. Instead, we hide it by adding a "hidden" class
  //  which sets 'display: none', and remove the class to show the element.
  container.classList = ""

  // hide the file upload UI
  dropArea.hidden = true
}

/**
 * Display a message to the user in the output area.
 * @param {string} text 
 */
 function showMessage(text) {
  const node = document.createElement('div')
  node.innerText = text
  output.appendChild(node)
}

/**
 * Display a URL in the output area as a clickable link.
 * @param {string} url 
 */
function showLink(url) {
  const node = document.createElement('a')
  node.href = url
  node.innerText = `> 🔗 ${url}`
  output.appendChild(node)
}

// #endregion upload-view

////////////////////////////////////
///////// Gallery view
////////////////////////////////////

// #region gallery-view

/**
 * DOM initialization for gallery view.
 */
async function setupGalleryUI() {
  const carousel = document.getElementById('carousel')
  const spinner = document.getElementById('carousel-spinner')
  const slideContainer = document.getElementById('slide-container')
  if (!slideContainer) {
    return
  }

  let numImages = 0
  for await (const image of listImageMetadata()) {
    const img = makeImageCard(image)
    const li = document.createElement('li')
    li.className = 'glide__slide'
    li.appendChild(img)
    slideContainer.appendChild(li)

    // show the carousel UI when we get the first image
    if (numImages == 0) {
      carousel.hidden = false
      spinner.hidden = true
    }
    numImages += 1
  }

  console.log(`loaded metadata for ${numImages} images`)
  // If we don't have any images, show a message telling the user to upload something
  if (numImages == 0) {
    spinner.hidden = true
    const noContentMessage = document.getElementById('no-content-message')
    noContentMessage.hidden = false
  }

  // activate the carousel
  new Glide('.glide').mount()
}

/**
 * Returns a DOM element for an image card in the gallery view.
 * @param {object} metadata
 * @returns {HTMLDivElement}
 */
function makeImageCard(metadata) {
  const wrapper = document.createElement('div')
  wrapper.className = 'gallery-image-card'

  const imgEl = document.createElement('img')
  imgEl.src = metadata.gatewayURL
  imgEl.alt = metadata.caption

  const label = document.createElement('span')
  label.className = 'gallery-image-caption'
  label.textContent = metadata.caption

  const shareLink = makeShareLink(metadata.gatewayURL)
  wrapper.appendChild(imgEl)
  wrapper.appendChild(label)
  wrapper.appendChild(shareLink)
  return wrapper
}

/**
 * Makes a link to view the image via the IPFS gateway.
 * @param {string} url 
 * @returns {HTMLAnchorElement}
 */
function makeShareLink(url) {
  const a = document.createElement('a')
  a.className = 'share-link'
  a.href = url
  
  const label = document.createElement('span')
  label.textContent = 'View on IPFS'
  const icon = document.createElement('span')
  icon.className = 'fontawesome-share'
  icon.style = 'padding: 10px'

  a.appendChild(label)
  a.appendChild(icon)
  return a
}

// #endregion gallery-view

////////////////////////////////////
///////// Token input view
////////////////////////////////////

// #region token-view

/**
 * DOM initialization for token management UI.
 */
function setupTokenUI() {
  if (!document.getElementById('token-ui')) {
    return
  }

  tokenInput.onchange = evt => {
    const token = evt.target.value
    if (!token) {
      return
    }
    saveToken(token)
    updateTokenUI()
  }

  const tokenDeleteButton = document.getElementById('token-delete-button')
  if (tokenDeleteButton) {
    tokenDeleteButton.onclick = evt => {
      evt.preventDefault()
      deleteSavedToken()
      updateTokenUI()
    }
  }

  updateTokenUI()
}

/**
 * Update the token UI to show the input box if we don't have a saved token, 
 * or the delete button if we do.
 */
function updateTokenUI() {
  const tokenEntrySection = document.getElementById('token-input-wrapper')
  const savedTokenSection = document.getElementById('saved-token-wrapper')
  const token = getSavedToken()
  if (token) {
    const savedTokenInput = document.getElementById('saved-token')
    savedTokenInput.value = token
    tokenEntrySection.hidden = true
    savedTokenSection.hidden = false
  } else {
    tokenEntrySection.hidden = false
    savedTokenSection.hidden = true
  }
}

// #endregion token-view

////////////////////////////////
///////// Navigation
////////////////////////////////

// #region navigation

function navToPath(path) {
  if (window.location.pathname !== path) {
    window.location.pathname = path
  }
}

function navToSettings() {
  navToPath('/settings.html')
}

function navToUpload() {
  navToPath('/')
}

function navToGallery() {
  navToPath('/gallery.html')
}

// #endregion navigation

////////////////////////////////
///////// Helper functions
////////////////////////////////

// #region helpers

function makeGatewayURL(cid, path) {
  return `https://${cid}.ipfs.dweb.link/${path}`
}

function jsonFile(filename, obj) {
  return new File([JSON.stringify(obj)], filename)
}

function getSavedToken() {
  return localStorage.getItem('w3storage-token')
}

function saveToken(token) {
  localStorage.setItem('w3storage-token', token)
}

function deleteSavedToken() {
  localStorage.removeItem('w3storage-token')
}

// #endregion helpers


////////////////////////////////
///////// Initialization
////////////////////////////////

// #region init

/**
 * DOM initialization for all pages.
 */
function setup() {
  setupTokenUI()
  setupUploadUI()
  setupGalleryUI()

  // redirect to settings page if there's no API token in local storage
  if (!getSavedToken()) {
    navToSettings()
  }
}

// call the setup function
setup()

// #endregion init