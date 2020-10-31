let _ = require('lodash');
let dotenv = require('dotenv');
let fs = require('fs');

let options = { path: getEnvPath(process.env.NODE_ENV), encoding: 'utf8' };
load(options);
dotenv.config(options);
console.log('NODE_ENV - ENVIROMENT:', process.env.NODE_ENV);

/**
 * Retorna o caminho do arquivo de variáveis de ambiente de acordo com o NODE_ENV (ambiente) informado.
 */
function getEnvPath(enviroment) {
    if (enviroment === "test")
        return ".env.test";
    else if (enviroment === "testing")
        return ".env.testing";
    else if (enviroment === "production")
        return ".env.production"
    else
        return ".env";
}

function load(options) {
    try {
        const envConfig = dotenv.parse(fs.readFileSync(options.path, options.encoding))

        _.each(envConfig, (value, key) => {
            if (process.env[key] === undefined) {
                process.env[key] = interpolate(value, envConfig)
            }
        })
    } catch (error) {
        return { error }
    }
}

/**
 * Substitui as variáveis do arquivo .env
 * @param {string} env valor da variável
 * @param {object} envConfig configurações
 */
function interpolate(env, envConfig) {
    const matches = env.match(/(\\)?\$([a-zA-Z0-9_]+)|(\\)?\${([a-zA-Z0-9_]+)}/g) || []
    _.each(matches, (match) => {
        /**
         * Variable is escaped
         */
        if (match.indexOf('\\') === 0) {
            env = env.replace(match, match.replace(/^\\\$/, '$'))
            return
        }
        const key = match.replace(/\$|{|}/g, '')
        const variable = envConfig[key] || process.env[key] || ''
        env = env.replace(match, interpolate(variable, envConfig))
    })
    return env
}