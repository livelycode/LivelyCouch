
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;
var email = require("./node_mailer");

var userName;
var password;
var host;

workerLib.setEventNamespace('email');

var dataStream = workerLib.createDataListener();

dataStream.on('data', function(d) {
  execute(d);
});

dataStream.on('end', function() {
  process.exit(0);
});
var execute = function(data) {
  var id = data.event.parameters.rewriteid;
  if(data.worker) {
    userName = data.worker.parameters.username;
    password = data.worker.parameters.password;
    host = data.worker.parameters.smtphost;
  }
  var from = data.event.parameters.from;
  var to = data.event.parameters.to;
  var subject = data.event.parameters.subject;
  var body = data.event.parameters.body;

  var userNameBuffer = new Buffer(userName.length);
  userNameBuffer.write(userName, offset=0, encoding="utf8");
  var userNameBase64 = userNameBuffer.toString("base64", 0, userNameBuffer.length);
  var passwordBuffer = new Buffer(password.length);
  passwordBuffer.write(password, offset=0, encoding="utf8");
  var passwordBase64 = passwordBuffer.toString("base64", 0, passwordBuffer.length);
  email.send({
    host : host,             // smtp server hostname
    port : "25",                        // smtp server port
    domain : "localhost",               // domain used by client to identify itself to server
    authentication : "login",           // auth login is supported; anything else is no auth
    username : userNameBase64,          // Base64 encoded username
    password : passwordBase64,             // Base64 encoded password
    to : to,
    from : from,
    subject : subject,
    body : body
  });
  workerLib.emitLivelyEvent('sent', {from: from, to: to, subject: subject});
}