const ForecastService = require('../forecast/forecast.service');
let CronJob = require('cron').CronJob;
ForecastService.taskForecast('Tabatinga');

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


new CronJob(
    '0 35 17 * * *',
    () => {
        ForecastService.taskForecast('Trestles_Lowers');
        ForecastService.taskForecast('Trestles_Uppers');
        ForecastService.taskForecast('Pipeline_1');
        ForecastService.taskForecast('Backdoor-5');
        ForecastService.taskForecast('Banzai-Pipelines-and-Backdoor');
        ForecastService.taskForecast('Rocky-Point_1');
        ForecastService.taskForecast('Sunset_1');
        ForecastService.taskForecast('Jaws');
        ForecastService.taskForecast('Waimea-Bay-Pinballs');
        ForecastService.taskForecast('Uluwatu');
        ForecastService.taskForecast('Padang-Padang');
        ForecastService.taskForecast('Macaronis');
        ForecastService.taskForecast('Lances-Right');
        ForecastService.taskForecast('Rifles');
        ForecastService.taskForecast('Kandui-Left');
        ForecastService.taskForecast('Lagundri-The-Point'); // Nias
        ForecastService.taskForecast('Desert-Point-Bangko-Bangko'); // Desert
        ForecastService.taskForecast('Grajagan-Bay'); // GBay
        ForecastService.taskForecast('Chicama');
        ForecastService.taskForecast('Punta-Rocas');
    }, null, true, 'Brazil/East');