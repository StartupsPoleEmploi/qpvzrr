const Nightmare = require('nightmare');
const bodyParser = require('body-parser');
const storage = require('node-persist');
const _ = require('lodash');
// see https://github.com/typicode/json-server/issues/253#issuecomment-205509836
const jsonServer = require('json-server');

const URL = 'https://sig.ville.gouv.fr/recherche-adresses-qp-polville';
console.log('Welcome to Nightmare scrape\n==========');
storage.initSync({dir:'./my_storage'});

var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser());

app.use('/zrr', jsonServer.defaults());
app.use('/zrr', jsonServer.router('db.json'));

// Add headers
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/allqpv', function (request, response, next) {
  response.send(_.zipObject(storage.keys(), storage.values()));
  next();
});

app.get('/isqpv', function (request, response, next) {

  if (request.query.q) {
    const q = request.query.q;
    console.log('looking for address : q is ' + q);
    var disambiguated_q = _address_disambiguation(q);
    console.log('looking for address : disambiguated_q is ' + disambiguated_q);
    const final_answer = storage.getItemSync(disambiguated_q);
    console.log('looking for address : final_answer is ' + final_answer);
    response.status(200).send(final_answer)
    next();
  } else {
    response.status(200).send('OK')
    next();
  }
});

// when you post a detailed code_postal, nom_commune etc
app.post('/setqpv', _setqpv);

function _setqpv(request, response, next) {
  response.status(200).send('OK');

  if (request.body.num_adresse && request.body.nom_voie && request.body.code_postal && request.body.nom_commune) {
    const location_key = request.body.num_adresse + ' ' + request.body.nom_voie + ' ' + request.body.code_postal + ' ' + request.body.nom_commune; 
    console.log('setqpv : location_key ' + location_key);
    var disambiguated_location_key = _address_disambiguation(location_key)
    console.log('setqpv : disambiguated_location_key ' + location_key);

    var already_have_address = storage.getItemSync(disambiguated_location_key);
    console.log('setqpv : already_have_address ' + already_have_address);
    if (already_have_address) {
      next();
      return;
    } 



     const nightmare = new Nightmare({ show: false })
     nightmare
     .goto(URL)
     .wait('input#code_postal')
     .type('input#code_postal', request.body.code_postal)
     .click('input#nom_commune')
     .type('input#nom_commune', request.body.nom_commune)
     .click('input#num_adresse')
     .type('input#num_adresse', request.body.num_adresse)
     .click('input#nom_voie')
     .type('input#nom_voie', request.body.nom_voie)
     .click('input.btSearch')
     .wait('.resultat_recherche_zus')
     .evaluate(() => document.querySelectorAll('#popup_content li').length)
     .then((result) => {
      if (result === 0 ) {
        return nightmare
        .click('input.btSearch')
        .wait('.system_messages li')
        .evaluate(() => {
          return {
            color:document.querySelector('.system_messages li').className, 
            qpv:document.querySelector('.system_messages li').innerHTML.toString().includes("L’adresse recherchée est située dans le quartier prioritaire")
          }
        })
        .then((obj) => {
          setFinalResult(location_key, obj );
        })
      } else {
        return nightmare
        .click('#popup_content li a')
        .wait('.system_messages li')
        .evaluate(() => {
          return {
            color:document.querySelector('.system_messages li').className, 
            qpv:document.querySelector('.system_messages li').innerHTML.toString().includes("L’adresse recherchée est située dans le quartier prioritaire")
          }
        })
        .then((obj) => {
          setFinalResult(location_key, obj);
        })
      }
    })
     .then(() => {
      console.log('setqpv : =========\nAll done...');
      return nightmare.end();
    })
     .catch((error) => {
      console.error('an error has occurred: ' + error);
    });
   } else {
    next();
    return;
  }
}


function _address_disambiguation(address) {
  return _.toUpper(_.deburr(address));
}

function setFinalResult(name, obj) {
  let final_result = null;
  if (obj.color === 'green' && obj.qpv === true) {
    final_result = 'is_qpv';
  }else if (obj.color === 'red' || obj.color === 'green') {
    final_result = 'is_not_qpv';
  } else {
    final_result = 'error';
  }
  console.log('setqpv : final_result is ' + final_result);
  console.log('setqpv : setting into storage ' + _address_disambiguation(name));

  storage.setItemSync(_address_disambiguation(name), final_result); 
}

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});

