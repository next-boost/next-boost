const init = () => {
  // start your server here
  console.log('prepare and start server')
  // return the listener, a sluggish page that takes 2 seconds to render
  return (_, res) => setTimeout(() => res.end(new Date().toISOString()), 2000)
}

module.exports = { default: init }
