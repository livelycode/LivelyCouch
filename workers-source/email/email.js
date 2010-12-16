
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

workerLib.initialize('email', function() {
  var workerParameters = workerLib.workerParameters;
  userName = workerParameters.username;
  password = workerParameters.password;
  host = workerParameters.smtphost;
  
  var eventStream = workerLib.openEventStream();
  eventStream.on('event', function(event) {
    execute(event);
  });
  
  eventStream.on('end', function() {
    process.exit(0);
  });
});

var execute = function(event) {
  var id = event.parameters.rewriteid;
  var from = event.parameters.from;
  var to = event.parameters.to;
  var subject = event.parameters.subject;
  var body = event.parameters.body;

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