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
    await PastPredictions.create(_forecasts.slice(3, 11));
    await Forecast.deleteMany({ spot_name: spot_name }).exec();
    await Forecast.create(_forecasts);
}

async function getForecast(spot_name) {
    const params = setForecastParams('basic,advanced', 'p,t');
    let responseForecast = await getSurfForecast(params, spot_name);
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
        // console.log(basic_forecast)
        return basic_forecast;
    }
    else return null;
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
    const wind_speed = json[0][8];
    const wind_state = json[0][9];
    const high_tide = json[0][10];
    const low_tide = json[0][11];

    let today_format = Moment().format('DD/MM/YYYY');
    let today_moment = Moment();
    let hourForecast = { rating: null, period: null, wave_height: null, wave_direction: null, energy: null, wind_speed: null, wind_direction: null, wind_state: null };
    let forecast = { [today_format]: { date: null, forecast: hourForecast, high_tides: [], low_tides: [], spot_name: spot_name, indexes: [] } };
    let actual_day = today_format;
    let actual_day_moment = today_moment;
    let is_1am = false, is_2am = false;

    // console.log(time)
    _.forEach(time, (it, index) => {
        // console.log('indexx', index + ': ', it.trim(), '0 AM: ' + (it.trim() == '0 AM'), '1 AM: ' + (it.trim() == '1 AM'), '2 AM: ' + (it.trim() == '2 AM'))

        if (index == 0) {   // today
            forecast[today_format] = { forecast: hourForecast, high_tides: [], low_tides: [], indexes: [] };
            forecast[today_format].indexes.push(Number(index));
        } else if (it.trim() == '0 AM' || it.trim() == '1 AM' || it.trim() == '2 AM') { // new day
            if (it.trim() == '1 AM') {
                // console.log("1 AM")
                is_1am = true;
                is_2am = false;
            } else if (it.trim() == '2 AM') {
                // console.log("2 AM")
                is_1am = false;
                is_2am = true;
            } else if (it.trim() == '0 AM') {
                // console.log("0 AM")
                is_1am = false;
                is_2am = false;
            }

            actual_day_moment = Moment(actual_day_moment).add(1, 'days');
            actual_day = Moment(actual_day_moment).format('DD/MM/YYYY');

            forecast[actual_day] = { forecast: hourForecast, high_tides: [], low_tides: [], indexes: [] };
            forecast[actual_day].indexes.push(Number(index));
        } else {
            forecast[actual_day].forecast = hourForecast;
            forecast[actual_day].indexes.push(Number(index));
        }
        forecast[actual_day].date = Moment(actual_day_moment).toDate();
    });

    let _forecasts = [];
    _.forEach(forecast, (it) => {
        // console.log('forecast indexes', it.indexes)
        it.indexes.forEach((i, index) => {
            // setting the hours of first day, shifting to the last hours of the day.
            if (it.indexes.length < 8 && i <= 7)
                index = 8 - it.indexes.length + index;

            let _hour;
            if (index == 0) _hour = is_2am ? 2 : (is_1am ? 1 : 0);
            else if (index == 1) _hour = is_2am ? 5 : (is_1am ? 4 : 3);
            else if (index == 2) _hour = is_2am ? 8 : (is_1am ? 7 : 6);
            else if (index == 3) _hour = is_2am ? 11 : (is_1am ? 10 : 9);
            else if (index == 4) _hour = is_2am ? 14 : (is_1am ? 13 : 12);
            else if (index == 5) _hour = is_2am ? 17 : (is_1am ? 16 : 15);
            else if (index == 6) _hour = is_2am ? 20 : (is_1am ? 19 : 18);
            else if (index == 7) _hour = is_2am ? 23 : (is_1am ? 22 : 21);

            // if advanced swells (1, 2 and 3) have been included.
            let _swell_1_forecast = _swell_2_forecast = _swell_3_forecast = { period: null, wave_height: null, wave_direction: null };
            if (advanced_content) {
                try {
                    const _swell_1_wave = getValueAndDirection(advanced_content.swell_1_wave[i.toString()]);
                    const _swell_1_period = advanced_content.swell_1_period[i.toString()];
                    _swell_1_forecast = {
                        period: toNumber(_swell_1_period),
                        wave_height: _swell_1_wave.value,
                        wave_direction: _swell_1_wave.direction
                    };

                    const _swell_2_wave = getValueAndDirection(advanced_content.swell_2_wave[i.toString()]);
                    const _swell_2_period = advanced_content.swell_2_period[i.toString()];
                    _swell_2_forecast = {
                        period: toNumber(_swell_2_period),
                        wave_height: _swell_2_wave.value,
                        wave_direction: _swell_2_wave.direction
                    };

                    const _swell_3_wave = getValueAndDirection(advanced_content.swell_3_wave[i.toString()]);
                    const _swell_3_period = advanced_content.swell_3_period[i.toString()];
                    _swell_3_forecast = {
                        period: toNumber(_swell_3_period),
                        wave_height: _swell_3_wave.value,
                        wave_direction: _swell_3_wave.direction
                    };
                } catch (e) {
                    console.error('Error on proccess advanced forecast.', e);
                }
            }

            const _high_tide = high_tide[i.toString()];
            if (_high_tide != '') it.high_tides.push(getTide(_high_tide))
            const _low_tide = low_tide[i.toString()];
            if (_low_tide != '') it.low_tides.push(getTide(_low_tide))

            const wind = getValueAndDirection(wind_speed[i.toString()]);
            const _wind_speed = wind ? wind.value : null;
            const _wind_direction = wind ? wind.direction : null;
            const _wind_state = wind_state[i.toString()];

            const wave = getValueAndDirection(wave_height[i.toString()]);
            const _wave_height = wave ? wave.value : null;
            const _wave_direction = wave ? wave.direction : null;

            const _energy = Number(energy[i.toString()]);
            const _rating = Number(rating[i.toString()]);
            const _period = toNumber(periods[i.toString()]);

            it.date = new Date(new Date(new Date(new Date(it.date).setHours(_hour)).setMinutes(0)).setSeconds(0, 0));
            it.forecast = setHourForecast(_period, _rating, _wave_height, _wave_direction, _energy, _wind_speed, _wind_direction, _wind_state, _swell_1_forecast, _swell_2_forecast, _swell_3_forecast);
            it.spot_name = spot_name;

            _forecasts.push(_.cloneDeep(it));
        });
    });

    return _forecasts;
}

function setHourForecast(_period, _rating, _wave_height, _wave_direction, _energy, _wind_speed, _wind_direction, _wind_state, _swell_1, _swell_2, _swell_3) {
    return {
        period: _period,
        rating: _rating,
        wave_height: _wave_height,
        wave_direction: _wave_direction,
        energy: _energy,
        wind_speed: _wind_speed,
        wind_direction: _wind_direction,
        wind_state: _wind_state,
        swell_1: _swell_1,
        swell_2: _swell_2,
        swell_3: _swell_3,
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
    else if (value.includes('SSO')) return { value: Number(value.replace('SSO', '')), direction: 'SSW' };
    else if (value.includes('SSW')) return { value: Number(value.replace('SSW', '')), direction: 'SSW' };
    else if (value.includes('OSO')) return { value: Number(value.replace('OSO', '')), direction: 'WSW' };
    else if (value.includes('WSW')) return { value: Number(value.replace('WSW', '')), direction: 'WSW' };
    else if (value.includes('ONO')) return { value: Number(value.replace('ONO', '')), direction: 'WNW' };
    else if (value.includes('WNW')) return { value: Number(value.replace('WNW', '')), direction: 'WNW' };
    else if (value.includes('NNO')) return { value: Number(value.replace('NNO', '')), direction: 'NNW' };
    else if (value.includes('NNW')) return { value: Number(value.replace('NNW', '')), direction: 'NNW' };
    else if (value.includes('NE')) return { value: Number(value.replace('NE', '')), direction: 'NE' };
    else if (value.includes('SE')) return { value: Number(value.replace('SE', '')), direction: 'SE' };
    else if (value.includes('SO')) return { value: Number(value.replace('SO', '')), direction: 'SW' };
    else if (value.includes('SW')) return { value: Number(value.replace('SW', '')), direction: 'SW' };
    else if (value.includes('NO')) return { value: Number(value.replace('NO', '')), direction: 'NW' };
    else if (value.includes('NW')) return { value: Number(value.replace('NW', '')), direction: 'NW' };
    else if (value.includes('N')) return { value: Number(value.replace('N', '')), direction: 'N' };
    else if (value.includes('E')) return { value: Number(value.replace('E', '')), direction: 'E' };
    else if (value.includes('S')) return { value: Number(value.replace('S', '')), direction: 'S' };
    else if (value.includes('O')) return { value: Number(value.replace('O', '')), direction: 'W' };
    else if (value.includes('W')) return { value: Number(value.replace('W', '')), direction: 'W' };
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
        value: toNumber(split[1])
    };
}

function toNumber(value) {
    try {
        if (value.trim() == 'NaN' || value.trim() == '-')
            return null;
        else return Number(value);
    } catch (e) {
        console.error('Number conversion error:', value, e);
    }
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