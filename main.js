import './style.css'
import { Web3Storage } from 'web3.storage'

const WEB3STORAGE_TOKEN = import.meta.env.VITE_WEB3STORAGE_TOKEN
const WEB3STORAGE_ENDPOINT = import.meta.env.DEV ? 'https://api-staging.web3.storage' : undefined

console.log('token:', WEB3STORAGE_TOKEN)

const web3storage = new Web3Storage({ token: WEB3STORAGE_TOKEN, endpoint: WEB3STORAGE_ENDPOINT })

async function storeImage(imageFile, caption) {
  console.log(`storing file ${imageFile.name}`)
  const cid = await web3storage.put([imageFile], { name: caption })
  console.log(`stored ${imageFile.name} - cid: ${cid}`)

  const gatewayURL = `https://${cid}.ipfs.dweb.link/${imageFile.name}`
  const uri = `ipfs://${cid}/${imageFile.name}`
  return { cid, uri, gatewayURL }
}

function setImagePreview(previewURL) {
  const img = document.getElementById('image-preview')
  img.src = previewURL
}

function setUploadButtonEnabled(enabled) {
  const button = document.getElementById('upload-button')
  button.hidden = !enabled
}

function getSelectedFile() {
  const input = document.getElementById('file-input')
  const files = input.files
  if (files.length < 1) {
    console.log('nothing selected')
    return null
  }
  return files[0]
}

function fileSelected() {
  const file = getSelectedFile()
  if (file == null) {
    console.log('nothing selected')
    setUploadButtonEnabled(false)
    return
  }
  const previewURL = URL.createObjectURL(file)
  setImagePreview(previewURL)
  setUploadButtonEnabled(true)
}

function getCaption() {
  const captionInput = document.getElementById('caption-input')
  return captionInput.value || ''
}

function uploadClicked(evt) {
  console.log('upload clicked')
  const file = getSelectedFile()
  if (file == null) {
    console.log('no file selected')
    return
  }
  
  const caption = getCaption()
  storeImage(file, caption).then(({ cid, gatewayURL, uri }) => {
    // TODO: do something with the cid (generate sharing link, etc)
    console.log('stored image with cid:', cid)
    console.log('ipfs uri:', uri)
    console.log('gateway url:', gatewayURL)
  })
}

function setup() {
  const fileInput = document.getElementById('file-input')
  fileInput.onchange = fileSelected

  const uploadButton = document.getElementById('upload-button')
  uploadButton.onclick = uploadClicked
}

setup()