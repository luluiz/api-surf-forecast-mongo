const Mongoose = require('mongoose');

const swellForecast = new Mongoose.Schema({
    period: Number,
    wave_height: Number,
    wave_direction: String,
});

const hourForecastSchema = new Mongoose.Schema({
    rating: Number,
    period: Number,
    wave_height: Number,
    wave_direction: String,
    energy: Number,
    wind_speed: Number,
    wind_direction: String,
    wind_state: String,
    swell_1: swellForecast,
    swell_2: swellForecast,
    swell_3: swellForecast,
});

const hoursSchema = new Mongoose.Schema({
    '0': hourForecastSchema,
    '3': hourForecastSchema,
    '6': hourForecastSchema,
    '9': hourForecastSchema,
    '12': hourForecastSchema,
    '15': hourForecastSchema,
    '18': hourForecastSchema,
    '21': hourForecastSchema,
});

const tideSchema = new Mongoose.Schema({
    hour: Number,
    minutes: Number,
    value: Number
});

const forecastSchema = new Mongoose.Schema({
    spot_name: { type: String },
    date: { type: Date },
    hours: hoursSchema,
    high_tides: [tideSchema],
    low_tides: [tideSchema],
});

module.exports.PastPredictions = Mongoose.model('PastPrefictons', forecastSchema);
module.exports.Forecast = Mongoose.model('Forecast', forecastSchema);