import './style.css'
import { Web3Storage } from 'web3.storage'

const WEB3STORAGE_TOKEN = import.meta.env.VITE_WEB3STORAGE_TOKEN
const WEB3STORAGE_ENDPOINT = import.meta.env.DEV ? 'https://api-staging.web3.storage' : undefined

const web3storage = new Web3Storage({ token: WEB3STORAGE_TOKEN, endpoint: WEB3STORAGE_ENDPOINT })

const previewImage = document.getElementById('image-preview')
const uploadButton = document.getElementById('upload-button')
const fileInput = document.getElementById('file-input')
const dropArea = document.getElementById('drop-area')
const captionInput = document.getElementById('caption-input') 
const output = document.getElementById('output')

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
 * Some DOM initialization stuff.
 */
function setup() {
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

// call the setup function
setup()
