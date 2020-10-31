const Mongoose = require('mongoose');
const uri = `mongodb://${process.env.DB_HOST}/${process.env.DB_DATABASE}`;
const options = {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false
};

module.exports = Mongoose.connect(uri, options, function (erro) {
    if (erro) console.error('Erro ao conectar com o DB: ' + erro);
    else console.log('Conectado ao DB: ' + uri);
});