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

const listingLocalStorageKey = 'w3s-example-listing-cid'
const listingUploadName = 'w3s-example-gallery-list.json'


/**
 * Stores a file on Web3.Storage, using the provided caption as the upload name.
 * @param {File} imageFile 
 * @param {string} caption 
 * @returns {object}
 */
async function storeImage(imageFile, caption) {
  console.log(`storing file ${imageFile.name}`)
  const cid = await web3storage.put([imageFile], {
    // the name is viewable at https://web3.storage/files and is included in the status and list API responses
    name: caption,

    // onRootCidReady will be called as soon as we've calculated the Content ID locally, before uploading
    onRootCidReady: (localCid) => {
      showMessage(`> 🔑 locally calculated Content ID: ${localCid} `)
      showMessage('> 📡 sending files to web3.storage ')
    },

    // onStoredChunk is called after each chunk of data is uploaded
    onStoredChunk: (bytes) => showMessage(`> 🛰 sent ${bytes.toLocaleString()} bytes to web3.storage`)
  })

  const gatewayURL = `https://${cid}.ipfs.dweb.link/${imageFile.name}`
  const uri = `ipfs://${cid}/${imageFile.name}`
  return { cid, uri, gatewayURL }
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
  storeImage(file, caption).then(({ cid, gatewayURL, uri }) => {
    // TODO: do something with the cid (generate sharing link, etc)
    showMessage(`stored image with cid: ${cid}`)
    showMessage(`ipfs uri: ${uri}`)
    showLink(gatewayURL)
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
function setupGalleryUI() {
  // TODO: wire up dom elements for gallery ui
}


/**
 * Get a list of metadata objects for each image stored in the gallery.
 */
async function getGalleryListing() {
  let listingCID = localStorage.getItem(listingLocalStorageKey)
  if (listingCID) {
    try {
      return getImageListByCID(listingCID)
    } catch (e) {
      console.error(`error getting listing using stored cid ${cid}: ${e.message}`)
      localStorage.removeItem(listingLocalStorageKey)
    }
  }

  listingCID = await findImageListCID()
  if (!listingCID) {
    console.log('no listing object found')
    return []
  }

  return getImageListByCID(listingCID)
}

async function getImageListByCID(cid) {
  const res = await web3storage.get(cid)
  if (!res.ok) {
    throw new Error(`error getting image listing (cid: ${cid}): [${res.status}] ${res.statusText}`)
  }

  const files = await res.files()
  if (files.length < 1) {
    throw new Error(`response for cid ${cid} did not contain any files`)
  }

  const jsonString = await files[0].text()
  return JSON.parse(jsonString)
}


async function findImageListCID() {
  console.log(`searching for most recent ${listingUploadName} upload`)
  for await (const upload of web3storage.list()) {
    if (upload.name !== listingUploadName) {
      continue
    }
    return upload.cid
  }
  return null
}

async function storeImageList(list) {
  const content = JSON.stringify(list)
  const file = new File([content], 'list.json')
  const cid = await web3storage.put([file], { name: listingUploadName })

  localStorage.setItem(listingLocalStorageKey, cid)
  return cid
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
  const list = [
    {cid: 'bafybeiam6gyclz3a32y2m7u7rtp4roypuiyv42cbhgjayffgfbjfmnz5va', path: 'decentralized-space-invaders.gif', caption: 'pew! pew!!'}
  ]
  storeImageList(list).then(cid => {
    console.log('image list cid:', cid)
  })

  getGalleryListing().then(list => console.log(list))
}

// call the setup function
setup()
