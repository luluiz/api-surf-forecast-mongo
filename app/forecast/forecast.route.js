const express = require('express');
const Forecast = require('./forecast.model').Forecast;
const PastPredictions = require('./forecast.model').PastPredictions;
const ForecastService = require('./forecast.service');
const router = express.Router();

module.exports = function (server) {
    server.use('/api', router);

    router.get('/forecast/:spot_name', ForecastService.get);
    router.get('/forecast/direct/:spot_name', ForecastService.getDirect);
    router.get('/forecast_past', ForecastService.getPastPredictions);

    return server;
};