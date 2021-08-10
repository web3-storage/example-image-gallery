# Web3.Storage example-image-gallery

This is an example of using [Web3.Storage](https://web3.storage) to create a simple image gallery that can be shared with your friends using decentralized web tech like [IPFS](https://ipfs.io) and [Filecoin](https://filecoin.io).

## Usage

Install dependencies:

```shell
npm install
```

Run the dev server:

```shell
npm run dev
```

Open http://localhost:3000 in your browser.

On the first run, you'll be redirected to http://localhost:3000/settings.html to paste in an API token. If you don't have a token yet, see the [Quickstart guide](https://docs.web3.storage/) to learn how to get one.
The token is saved to your browser's local storage, so you should only need to do this once.

## Code Overview

This example project is written in "vanilla" JavaScript, HTML and CSS, so there's no UI framework like React or Vue in the mix, just good old `document.getElementById` and friends.

The JavaScript code uses features from the ES2018 language standard, which is supported by all modern browsers (Internet Explorer [officially doesn't count](https://techcommunity.microsoft.com/t5/windows-it-pro-blog/internet-explorer-11-desktop-app-retirement-faq/ba-p/2366549)).

There are three HTML pages:

- `index.html` has the image upload UI
- `gallery.html` has a carousel that displays your uploaded images
- `settings.html` has a box to paste your API token into (or delete it)

All the pages import the `main.js` file as a [JavaScript module](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), which contains the UI logic for each page, as well as the code that interacts with Web3.Storage.

The main "entry point" is the `setup` function at the bottom of `main.js`, which calls the setup function for each of the UI sections (e.g. `setupUploadUI`, `setupGalleryUI`). Note that we always call these setup functions even if we're not on the page they correspond to, since they'll just return early if the DOM elements they expect aren't present on the page.

### Web3.Storage interactions

Most of the code in `main.js` deals with setting up and managing the UI. The parts that are specific to Web3.Storage are all near the top of the file, in a section marked with this comment header:

```javascript
////////////////////////////////
////// Image upload & listing
////////////////////////////////
```

#### Uploading images

Images are uploaded in the `storeImage` function, which takes a [File](https://developer.mozilla.org/en-US/docs/Web/API/File) object and some caption text as input.

The `storeImage` function actually stores two files - we also create a small `metadata.json` file that includes the caption text and the original filename. Both files are bundled up by Web3.Storage into one IPFS directory listing.

#### Listing images for the gallery view

The `listImageMetadata` function returns an [async iterator](https://2ality.com/2016/10/asynchronous-iteration.html) that will `yield` metadata about our stored images. This includes the caption we stored, as well as the IPFS Content ID and an IPFS gateway URL to the image.

`listImageMetadata` uses the [`list` Web3.Storage client method](https://docs.web3.storage/reference/client-library/#list-uploads) to get metadata about all files stored using Web3.Storage and selects the ones we're interested in by checking their `name` field for a special string prefix (added in the `storeImage` method when uploading). Once it has the root CID for each upload, `listImageMetadata` will fetch the stored `metadata.json` and `yield` a metadata object to the calling function.

