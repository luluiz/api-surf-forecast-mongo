const router = require('express').Router();

module.exports = function (app) {
    app.use('/api', router);

    return router;
};