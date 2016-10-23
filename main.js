const https = require('https');
const IncomingWebhooks = require('@slack/client').IncomingWebhook;
const URL = require('url');
const moment = require('moment');

exports.handler = function (event, context, callback) {
  var wh = new IncomingWebhooks(event.slack_webhook_url, {
    iconEmoji: ':closed_lock_with_key:',
    username: 'SSL Notifier'
  });

  var promises = event.urls.map(function (url) {
    return HTTPSRequest(url).then(function (res) {
      var isValid = moment().isBefore(moment(res.valid_to));
      var isExpiringSoon = moment().add(5, 'days').isAfter(moment(res.valid_to));

      var colour = "";
      if (isValid && !isExpiringSoon) {
        colour = "good"
      } else if (isValid && isExpiringSoon) {
        colour = "warning"
      } else {
        colour = "danger";
      }
      wh.send({
        "attachments": [{
          "color": colour,
          "title": res.url,
          "title_link": URL.parse(res.url),
          "fields": [{
            "title": "Valid From",
            "value": moment(res.valid_from).format('DD MMM YYYY')
          }, {
            "title": "Valid To",
            "value": moment(res.valid_to).format('DD MMM YYYY')
          }, {
            "title": "Issuer",
            "value": res.issuer
          }],
          "ts": Date.now() / 1000 | 0
        }]
      });
      return res;
    });
  });

  Promise.all(promises).then(function (res) {
    callback(null, "Success");
  }).catch(function (e) {
    console.log(e);
    callback(e);
  });

};


function HTTPSRequest(url) {
  return new Promise(function (resolve, reject) {
    var request = https.get({
      hostname: url
    }, function (response) {
      var cert = response.connection.getPeerCertificate();
      resolve({
        url: url,
        issuer: cert.issuer.CN,
        valid_from: cert.valid_from,
        valid_to: cert.valid_to,
        serial_number: cert.serialNumber
      })
    });
    request.on('error', function (error) {
      reject(error.message);
    });
  });
}