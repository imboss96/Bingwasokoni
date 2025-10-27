const proxy = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api', // Route API calls through /api path
    proxy({
      target: 'http://localhost:5000', // Backend URL (running on localhost)
      changeOrigin: true,
      pathRewrite: {
        '^/api': '', // Remove `/api` from the path before sending to backend
      },
    })
  );
};
