const ForecastService = require('../forecast/forecast.service');
let CronJob = require('cron').CronJob;

new CronJob(
    '0 0 17 * * *',
    () => {
        ForecastService.taskForecast('Tabatinga');
        ForecastService.taskForecast('Miami');
        ForecastService.taskForecast('Madeiro');
        ForecastService.taskForecast('Urcada-Conceicao');
        ForecastService.taskForecast('Lajao');
        ForecastService.taskForecast('Lajinha');
        ForecastService.taskForecast('Touros-Area');
        ForecastService.taskForecast('Pontal_1');
        ForecastService.taskForecast('Saji');
        ForecastService.taskForecast('Praia-de-Pipa');
    }, null, true, 'Brazil/East');