const app = require('./app');
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV != 'test')
    app.listen(PORT, function () {
        console.log(`Server is running on port ${PORT}.`);
    });