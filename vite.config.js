const { resolve } = require('path')

module.exports = {
  base: '',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        gallery: resolve(__dirname, 'gallery.html'),
        settings: resolve(__dirname, 'settings.html'),
      }
    }
  }
}
