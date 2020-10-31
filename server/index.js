require('./env-config');

const router = require('express').Router();
const app = require('./app');
app.use('/api', router);

require('./server');
require('./database');
require('../app/scheduler/tasks.service');
require('../app/forecast/forecast.route')(app);


