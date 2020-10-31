const _ = require('lodash');
const Request = require('request');
const QueryString = require('querystring');
const Mongoose = require('mongoose');
const Moment = require('moment-timezone');
const PastPredictions = require('./forecast.model').PastPredictions;
const Forecast = require('./forecast.model').Forecast;
const Tabletojson = require('tabletojson').Tabletojson;

module.exports.get = async function (req, res) {
    const spot_name = req.params.spot_name;
    try {
        const forecasts = await Forecast.find({ spot_name: spot_name });
        res.status(200).json({ success: true, forecasts: forecasts });
    } catch (e) {
        console.error(`${Moment().format('DD/MM/YYYY HH:mm:ss')} - Something went wrong:`, e);
        res.status(500).send('Something went wrong.')
    }
}

module.exports.getPastPredictions = async function (req, res) {
    try {
        // console.log('params', req.params)
        // console.log('query', req.query)
        let filters = {};
        if (req.query.spot_name) filters.spot_name = req.query.spot_name;
        if (req.query.date_from && req.query.date_to) filters.date = {
            $gte: Moment(new Date(req.query.date_from)).add(1, 'day').startOf('day').toDate(),
            $lte: Moment(new Date(req.query.date_to)).add(1, 'day').endOf('day').toDate()
        };
        const forecasts = await PastPredictions.find(filters);
        res.status(200).json({ success: true, forecasts: forecasts });
    } catch (e) {
        console.error(`${Moment().format('DD/MM/YYYY HH:mm:ss')} - Something went wrong:`, e);
        res.status(500).send('Something went wrong.')
    }
}

module.exports.getDirect = async function (req, res) {
    const spot_name = req.params.spot_name;
    const _forecasts = await getForecast(spot_name);
    try {
        res.status(200).json({ success: true, forecast: _forecasts });
    } catch (e) {
        console.error(`${Moment().format('DD/MM/YYYY HH:mm:ss')} - Something went wrong:`, e);
        res.status(500).send('Something went wrong.')
    }
}

module.exports.taskForecast = async function (spot_name) {
    console.log(`${Moment().format('DD/MM/YYYY HH:mm:ss')} - Task performed for surf forecast in ${spot_name}`);
    const _forecasts = await getForecast(spot_name);
    await PastPredictions.create(_forecasts[0]);
    await Forecast.deleteMany({ spot_name: spot_name }).exec();
    await Forecast.create(_forecasts);
}

async function getForecast(spot_name) {
    const params = setForecastParams('basic,advanced', 'p,t');
    let responseForecast = await getSurfForecast(params, spot_name);
    let _forecasts = [];
    let basic_content, advanced_content;

    try {
        basic_content = responseForecast.period_types.t.parts.basic.content;
        advanced_content = responseForecast.period_types.t.parts.advanced.content;
    } catch (e) {
        console.error('Error on access content of the response', e);
    }

    if (basic_content) {
        let advanced_forecast = setAdvancedForecast(advanced_content);
        let basic_forecast = setBasicForecast(basic_content, advanced_forecast, spot_name);

        _.forEach(basic_forecast, it => {
            _forecasts.push(it);
        });
    }

    return _forecasts;
}

function setAdvancedForecast(content) {
    const json = Tabletojson.convert(`<table>${content}</table>`);
    // console.log('json', json);
    const swell_1_wave = json[0][2];
    const swell_1_period = json[0][3];
    const swell_2_wave = json[0][4];
    const swell_2_period = json[0][5];
    const swell_3_wave = json[0][6];
    const swell_3_period = json[0][7];

    return { // FALTA IMPLEMENTAR EM BASIC PARA PEGAR ESSAS INFOS
        swell_1_wave: swell_1_wave,
        swell_1_period: swell_1_period,
        swell_2_wave: swell_2_wave,
        swell_2_period: swell_2_period,
        swell_3_wave: swell_3_wave,
        swell_3_period: swell_3_period,
    }
}

function setBasicForecast(content, advanced_content, spot_name) {
    content = content.replace(/<img alt="0"/gi, '0<img alt="0"')
        .replace(/<img alt="1"/gi, '1<img alt="1"')
        .replace(/<img alt="2"/gi, '2<img alt="2"')
        .replace(/<img alt="3"/gi, '3<img alt="3"')
        .replace(/<img alt="4"/gi, '4<img alt="4"')
        .replace(/<img alt="5"/gi, '5<img alt="5"')
        .replace(/<img alt="6"/gi, '6<img alt="6"')
        .replace(/<img alt="7"/gi, '7<img alt="7"')
        .replace(/<img alt="8"/gi, '8<img alt="8"')
        .replace(/<img alt="9"/gi, '9<img alt="9"')
        .replace(/<img alt="10"/gi, '10<img alt="10"');

    const json = Tabletojson.convert(`<table>${content}</table>`);
    // console.log('json', json);

    const time = json[0][1];
    const rating = json[0][2];
    // const maps = json[0][3];
    const wave_height = json[0][4];
    const periods = json[0][5];
    // const wave_graph = json[0][6];
    const energy = json[0][7];
    // const wind = json[0][8];
    const wind_state = json[0][9];
    const high_tide = json[0][10];
    const low_tide = json[0][11];

    let today_format = Moment().format('DD/MM/YYYY');
    let today_moment = Moment();
    let hourForecast = { rating: null, period: null, wave_height: null, wave_direction: null, energy: null, wind_speed: null, wind_direction: null, wind_state: null };
    let hours = { '0': hourForecast, '3': hourForecast, '6': hourForecast, '9': hourForecast, '12': hourForecast, '15': hourForecast, '18': hourForecast, '21': hourForecast };
    let forecast = { [today_format]: { date: null, hours: hours, high_tides: [], low_tides: [], spot_name: spot_name, indexes: [] } };
    let actual_day = today_format;
    let actual_day_moment = today_moment;

    _.forEach(time, (it, index) => {
        // console.log('index it:', it, it.trim() == '0 AM' ? true : '')
        if (index == 0) {   // today
            forecast[today_format].indexes.push(Number(index));
        } else if (it.trim() == '0 AM') { // new day
            // console.log('new day')

            actual_day_moment = Moment(actual_day_moment).add(1, 'days');
            actual_day = Moment(actual_day_moment).format('DD/MM/YYYY');

            forecast[actual_day] = { hours: hours, high_tides: [], low_tides: [], indexes: [] };
            forecast[actual_day].indexes.push(Number(index));
        } else {
            forecast[actual_day].hours = hours;
            forecast[actual_day].indexes.push(Number(index));
        }
        forecast[actual_day].date = Moment(actual_day_moment).toDate();
    });

    _.forEach(forecast, (it, index) => {
        it.indexes.forEach(i => {
            if (advanced_content) {
                try {
                    const _swell_1_wave = getValueAndDirection(advanced_content.swell_1_wave[i.toString()]);
                    const _swell_1_period = advanced_content.swell_1_period[i.toString()];
                    const _swell_1_forecast = {
                        period: _swell_1_period,
                        wave_height: _swell_1_wave.value,
                        wave_direction: _swell_1_wave.direction
                    };
                    it.hours['0'].swell_1 = _swell_1_forecast;
                    it.hours['3'].swell_1 = _swell_1_forecast;
                    it.hours['6'].swell_1 = _swell_1_forecast;
                    it.hours['9'].swell_1 = _swell_1_forecast;
                    it.hours['12'].swell_1 = _swell_1_forecast;
                    it.hours['15'].swell_1 = _swell_1_forecast;
                    it.hours['18'].swell_1 = _swell_1_forecast;
                    it.hours['21'].swell_1 = _swell_1_forecast;

                    const _swell_2_wave = getValueAndDirection(advanced_content.swell_2_wave[i.toString()]);
                    const _swell_2_period = advanced_content.swell_2_period[i.toString()];
                    const _swell_2_forecast = {
                        period: _swell_2_period,
                        wave_height: _swell_2_wave.value,
                        wave_direction: _swell_2_wave.direction
                    };
                    it.hours['0'].swell_2 = _swell_2_forecast;
                    it.hours['3'].swell_2 = _swell_2_forecast;
                    it.hours['6'].swell_2 = _swell_2_forecast;
                    it.hours['9'].swell_2 = _swell_2_forecast;
                    it.hours['12'].swell_2 = _swell_2_forecast;
                    it.hours['15'].swell_2 = _swell_2_forecast;
                    it.hours['18'].swell_2 = _swell_2_forecast;
                    it.hours['21'].swell_2 = _swell_2_forecast;

                    const _swell_3_wave = getValueAndDirection(advanced_content.swell_3_wave[i.toString()]);
                    const _swell_3_period = advanced_content.swell_3_period[i.toString()];
                    const _swell_3_forecast = {
                        period: _swell_3_period,
                        wave_height: _swell_3_wave.value,
                        wave_direction: _swell_3_wave.direction
                    };
                    it.hours['0'].swell_3 = _swell_3_forecast;
                    it.hours['3'].swell_3 = _swell_3_forecast;
                    it.hours['6'].swell_3 = _swell_3_forecast;
                    it.hours['9'].swell_3 = _swell_3_forecast;
                    it.hours['12'].swell_3 = _swell_3_forecast;
                    it.hours['15'].swell_3 = _swell_3_forecast;
                    it.hours['18'].swell_3 = _swell_3_forecast;
                    it.hours['21'].swell_3 = _swell_3_forecast;
                } catch (e) {
                    console.error('Error on proccess advanced forecast.', e);
                }
            }

            const _rating = rating[i.toString()];
            it.hours['0'].rating = Number(_rating);
            it.hours['3'].rating = Number(_rating);
            it.hours['6'].rating = Number(_rating);
            it.hours['9'].rating = Number(_rating);
            it.hours['12'].rating = Number(_rating);
            it.hours['15'].rating = Number(_rating);
            it.hours['18'].rating = Number(_rating);
            it.hours['21'].rating = Number(_rating);

            const _period = periods[i.toString()];
            it.hours['0'].period = Number(_period);
            it.hours['3'].period = Number(_period);
            it.hours['6'].period = Number(_period);
            it.hours['9'].period = Number(_period);
            it.hours['12'].period = Number(_period);
            it.hours['15'].period = Number(_period);
            it.hours['18'].period = Number(_period);
            it.hours['21'].period = Number(_period);

            // WAVE HEIGHT
            const wave = getValueAndDirection(wave_height[i.toString()])
            const _height = wave ? wave.value : null;
            const _direction = wave ? wave.direction : null;
            it.hours['0'].wave_height = _height;
            it.hours['3'].wave_height = _height;
            it.hours['6'].wave_height = _height;
            it.hours['9'].wave_height = _height;
            it.hours['12'].wave_height = _height;
            it.hours['15'].wave_height = _height;
            it.hours['18'].wave_height = _height;
            it.hours['21'].wave_height = _height;

            // WAVE DIRECTION
            it.hours['0'].wave_direction = _direction;
            it.hours['3'].wave_direction = _direction;
            it.hours['6'].wave_direction = _direction;
            it.hours['9'].wave_direction = _direction;
            it.hours['12'].wave_direction = _direction;
            it.hours['15'].wave_direction = _direction;
            it.hours['18'].wave_direction = _direction;
            it.hours['21'].wave_direction = _direction;

            // ENERGY
            const _energy = energy[i.toString()];
            it.hours['0'].energy = Number(_energy);
            it.hours['3'].energy = Number(_energy);
            it.hours['6'].energy = Number(_energy);
            it.hours['9'].energy = Number(_energy);
            it.hours['12'].energy = Number(_energy);
            it.hours['15'].energy = Number(_energy);
            it.hours['18'].energy = Number(_energy);
            it.hours['21'].energy = Number(_energy);

            // WIND SPEED
            const wind = getValueAndDirection(wave_height[i.toString()])
            const _speed = wind ? wind.value : null;
            const _wind_direction = wind ? wind.direction : null;
            it.hours['0'].wind_speed = _speed;
            it.hours['3'].wind_speed = _speed;
            it.hours['6'].wind_speed = _speed;
            it.hours['9'].wind_speed = _speed;
            it.hours['12'].wind_speed = _speed;
            it.hours['15'].wind_speed = _speed;
            it.hours['18'].wind_speed = _speed;
            it.hours['21'].wind_speed = _speed;

            // WIND DIRECTION
            it.hours['0'].wind_direction = _wind_direction;
            it.hours['3'].wind_direction = _wind_direction;
            it.hours['6'].wind_direction = _wind_direction;
            it.hours['9'].wind_direction = _wind_direction;
            it.hours['12'].wind_direction = _wind_direction;
            it.hours['15'].wind_direction = _wind_direction;
            it.hours['18'].wind_direction = _wind_direction;
            it.hours['21'].wind_direction = _wind_direction;

            // WIND STATE
            const _wind_state = wind_state[i.toString()];
            it.hours['0'].wind_state = _wind_state;
            it.hours['3'].wind_state = _wind_state;
            it.hours['6'].wind_state = _wind_state;
            it.hours['9'].wind_state = _wind_state;
            it.hours['12'].wind_state = _wind_state;
            it.hours['15'].wind_state = _wind_state;
            it.hours['18'].wind_state = _wind_state;
            it.hours['21'].wind_state = _wind_state;

            const _high_tide = high_tide[i.toString()];
            if (_high_tide != '') it.high_tides.push(getTide(_high_tide))
            const _low_tide = low_tide[i.toString()];
            if (_low_tide != '') it.low_tides.push(getTide(_low_tide))
            it.spot_name = spot_name;
            // console.log(it.hours)
        });
        // console.log(it.high_tides)
        // console.log(it.low_tides)
    });

    return forecast;
}

function getSwellForecast(value) {
    return {
        period: Number,
        wave_height: Number,
        wave_direction: String,
    }
}

/**
 * Value of wave or wind with height/speed and direction.
 * @param {string} value wave or wind
 */
function getValueAndDirection(value) {
    if (value.trim() == '-') return { value: null, direction: null };
    else if (value.includes('NNE')) return { value: Number(value.replace('NNE', '')), direction: 'NNE' };
    else if (value.includes('ENE')) return { value: Number(value.replace('ENE', '')), direction: 'ENE' };
    else if (value.includes('ESE')) return { value: Number(value.replace('ESE', '')), direction: 'ESE' };
    else if (value.includes('SSE')) return { value: Number(value.replace('SSE', '')), direction: 'SSE' };
    else if (value.includes('SSO')) return { value: Number(value.replace('SSO', '')), direction: 'SSO' };
    else if (value.includes('OSO')) return { value: Number(value.replace('OSO', '')), direction: 'OSO' };
    else if (value.includes('ONO')) return { value: Number(value.replace('ONO', '')), direction: 'ONO' };
    else if (value.includes('NNO')) return { value: Number(value.replace('NNO', '')), direction: 'NNO' };
    else if (value.includes('NE')) return { value: Number(value.replace('NE', '')), direction: 'NE' };
    else if (value.includes('SE')) return { value: Number(value.replace('SE', '')), direction: 'SE' };
    else if (value.includes('SO')) return { value: Number(value.replace('SO', '')), direction: 'SO' };
    else if (value.includes('NO')) return { value: Number(value.replace('NO', '')), direction: 'NO' };
    else if (value.includes('N')) return { value: Number(value.replace('N', '')), direction: 'N' };
    else if (value.includes('E')) return { value: Number(value.replace('E', '')), direction: 'E' };
    else if (value.includes('S')) return { value: Number(value.replace('S', '')), direction: 'S' };
    else if (value.includes('O')) return { value: Number(value.replace('O', '')), direction: 'O' };
    else return null;
}

/**
 * Return a object with hour, minutes, time string and tide.
 * @param {string} value time and tide
 */
function getTide(value) {
    let split = value.split(' ');

    // Corrigindo casos de inconsistencia nos dados. Quando a hora e maré não estão juntos: "9:18AM0.22"
    if (!split[1]) {
        let _split;
        const isAM = split[0].includes('AM');
        const isPM = split[0].includes('PM')
        if (isAM) {
            _split = split[0].split('AM');
            _split[0] = _split[0] + 'AM';
        } else if (isPM) {
            _split = split[0].split('PM');
            _split[0] = _split[0] + 'PM';
        }

        split[0] = _split[0];
        split.push(_split[1])
    }

    let _hour = Number(split[0].split(':')[0]);
    let _minute = split[0].split(':')[1];

    if (_minute.includes('AM')) {
        _minute = Number(_minute.replace('AM', ''));
    } else if (_minute.includes('PM')) {
        _hour += 12;
        _minute = Number(_minute.replace('PM', ''));
    }
    return {
        hour: _hour,
        minutes: _minute,
        time: split[0],
        value: split[1] == 'NaN' ? null : Number(split[1])
    };
}

/**
 * Params of req to surf forecast
 * @param {string} parts all, basic, advanced, weather, local, global
 * @param {string} period_types t,h (per hour, per period of 3 hours)
 * @param {string} forecast_duration null, 48h
 */
function setForecastParams(parts, period_types, forecast_duration) {
    let parameters = {};
    if (parts) parameters.parts = parts;
    if (period_types) parameters.period_types = period_types;
    if (forecast_duration) parameters.forecast_duration = forecast_duration;
    return parameters;
}

async function getSurfForecast(params, spot_name) {
    const queryParams = QueryString.stringify(params);
    const URL = `https://pt.surf-forecast.com/breaks/${spot_name}/forecasts/data?${queryParams.replace('%2C', ',')}`;

    return await new Promise((resolve, reject) => {
        Request(URL, { json: true, timeout: 30000 }, async (error, response, body) => {
            if (error)
                reject({ message: 'Error.', error: error });
            else if (body.period_types)
                resolve(body);
            else
                reject({ message: 'Something went wrong.' })
        });
    });
}
