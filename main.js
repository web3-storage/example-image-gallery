import './style.css'
import { Web3Storage } from 'web3.storage'

const WEB3STORAGE_TOKEN = import.meta.env.VITE_WEB3STORAGE_TOKEN

const web3storage = new Web3Storage({ token: WEB3STORAGE_TOKEN })

const uploadUIContainer = document.getElementById('upload-ui')
const previewImage = document.getElementById('image-preview')
const uploadButton = document.getElementById('upload-button')
const fileInput = document.getElementById('file-input')
const dropArea = document.getElementById('drop-area')
const captionInput = document.getElementById('caption-input') 
const output = document.getElementById('output')

const galleryUIContainer = document.getElementById('gallery-ui')

const namePrefix = 'ImageGallery'

/**
 * Stores a file on Web3.Storage, using the provided caption as the upload name.
 * @param {File} imageFile 
 * @param {string} caption 
 * @returns {object}
 */
async function storeImage(imageFile, caption) {
  const metadata = {
    path: imageFile.name,
    caption
  }
  const metadataFile = new File([JSON.stringify(metadata)], 'metadata.json')

  const uploadName = [namePrefix, caption].join('|')

  console.log(`storing file ${imageFile.name}`)
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
 * Returns the currently selected file, or null if nothing has been selected.
 * @returns {File|null}
 */
function getSelectedFile() {
  if (fileInput.files.length < 1) {
    console.log('nothing selected')
    return null
  }
  return fileInput.files[0]
}

/**
 * Callback for file input onchange event, fired when the user makes a file selection.
 */
function fileSelected() {
  const file = getSelectedFile()
  handleFileSelected(file)
}

/**
 * Callback for 'drop' event that fires when user drops a file onto the drop-area div.
 * Note: currently doesn't check if the file is an image before accepting.
 */
 function fileDropped(evt) {
  evt.preventDefault()
  fileInput.files = evt.dataTransfer.files
  const files = [...evt.dataTransfer.files]
  if (files.length < 1) {
    console.log('drop handler recieved no files, ignoring drop event')
    return
  }
  handleFileSelected(files[0])
}

/**
 * Respond to file selection, whether through drag-and-drop or manual selection.
 * Side effects: sets preview image to file content and sets upload button state to enabled.
 */
function handleFileSelected(file) {
  if (file == null) {
    uploadButton.disabled = true
    return
  }
  previewImage.src = URL.createObjectURL(file)
  uploadButton.disabled = false
}

/**
 * Callback for upload button's onclick event. Calls storeImage with user selected file and caption text.
 * @param {Event} evt 
 * @returns 
 */
function uploadClicked(evt) {
  evt.preventDefault()
  console.log('upload clicked')
  const file = getSelectedFile()
  if (file == null) {
    console.log('no file selected')
    return
  }
  
  const caption = captionInput.value || ''
  storeImage(file, caption).then(({ cid, imageGatewayURL, imageURI, metadataGatewayURL, metadataURI }) => {
    // TODO: do something with the cid (generate sharing link, etc)
    showMessage(`stored image with cid: ${cid}`)
    showMessage(`ipfs image uri: ${imageURI}`)
    showLink(metadataGatewayURL)
    showMessage(`ipfs metadata uri: ${metadataURI}`)
    showLink(imageGatewayURL)
  })
}

/**
 * Display a message to the user in the output area.
 * @param {string} text 
 */
function showMessage (text) {
  const node = document.createElement('div')
  node.innerText = text
  output.appendChild(node)
}

/**
 * Display a URL in the output area as a clickable link.
 * @param {string} url 
 */
function showLink (url) {
  const node = document.createElement('a')
  node.href = url
  node.innerText = `> 🔗 ${url}`
  output.appendChild(node)
}

function makeGatewayURL(cid, path) {
  return `https://${cid}.ipfs.dweb.link/${path}`
}

/**
 * DOM initialization for upload UI.
 */
 function setupUploadUI() {
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
 * DOM initialization for gallery view.
 */
async function setupGalleryUI() {
  const images = await getGalleryListing()
  console.log('images:', images)

  for (const image of images) {
    const img = makeImageCard(image)
    galleryUIContainer.appendChild(img)
  }
}

/**
 * Returns a DOM element for an image card in the gallery view.
 * @param {object} metadata 
 */
function makeImageCard(metadata) {
  const wrapper = document.createElement('div')
  wrapper.className = 'gallery-image-card'

  const imgEl = document.createElement('img')
  imgEl.src = metadata.gatewayURL
  imgEl.alt = metadata.caption

  const label = document.createElement('span')
  label.textContent = metadata.caption
  wrapper.appendChild(imgEl)
  wrapper.appendChild(label)
  return wrapper
}


/**
 * Get a list of metadata objects for each image stored in the gallery.
 */
async function getGalleryListing() {
  const images = []
  for await (const upload of web3storage.list()) {
    if (!upload.name || !upload.name.startsWith(namePrefix)) {
      continue
    }
    
    try {
      const metadata = await getImageMetadata(upload.cid)
      const gatewayURL = makeGatewayURL(upload.cid, metadata.path)
      images.push({...metadata, gatewayURL})
    } catch (e) {
      console.error('error getting image metadata:', e)
      continue
    }
  }
  
  return images
}


async function getImageMetadata(rootCID) {
  const url = makeGatewayURL(rootCID, 'metadata.json')
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`error fetching image metadata: [${res.status}] ${res.statusText}`)
  }
  return res.json()
}

/**
 * DOM initialization for all pages.
 */
function setup() {
  if (uploadUIContainer) {
    setupUploadUI()
  }
  if (galleryUIContainer) {
    setupGalleryUI()
  }

  // test code, rm plz
  getGalleryListing().then(list => console.log(list))
}

// call the setup function
setup()
