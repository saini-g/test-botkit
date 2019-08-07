const request = require('request');

module.exports = {
    postForm: (url, data) => {
        return new Promise((resolve, reject) => {
            request.post({
                url: url,
                form: data
            }, (err, httpResponse, body) => {

                if (err) {
                    reject(err);
                } else {
                    resolve(body);
                }
            });
        });
    }
};