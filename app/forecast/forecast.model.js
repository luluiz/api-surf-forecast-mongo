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

const tideSchema = new Mongoose.Schema({
    hour: Number,
    minutes: Number,
    value: Number
});

const forecastSchema = new Mongoose.Schema({
    spot_name: { type: String, index: true },
    date: { type: Date, index: true },
    forecast: hourForecastSchema,
    high_tides: [tideSchema],
    low_tides: [tideSchema],
}, { timestamps: true, });


module.exports.PastPredictions = Mongoose.model('PastPrefictons', forecastSchema);
module.exports.Forecast = Mongoose.model('Forecast', forecastSchema);