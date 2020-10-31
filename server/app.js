const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const allowCors = require('./cors');

app.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));
app.use(bodyParser.json());
app.use(allowCors);

module.exports = app;