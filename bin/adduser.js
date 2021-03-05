'use strict';
/* eslint no-process-exit:off */
/**
 * Created by kras on 24.08.16.
 */
const fs = require('fs');
const path = require('path');
const extend = require('extend');

let config_file = process.argv[2] || process.env.ION_CONFIG_PATH || 'config';

config_file = path.isAbsolute(config_file)
  ? config_file
  : path.normalize(path.join(process.cwd(), config_file));

const config = fs.existsSync(config_file) ? require(config_file) : {};

const default_config = require('../config');

const { di } = require('@iondv/core');
const { log: { IonLogger } } = require('@iondv/commons');
const { t, lang, load } = require('@iondv/i18n');

const alias = di.alias;

lang(config.lang);

var sysLog = new IonLogger({});

var name = 'admin';
var pwd = 'admin';

var setName = false;
var setPwd = false;

process.argv.forEach(function (val) {
  if (val === '--name') {
    setName = true;
    setPwd = false;
    return;
  } else if (val === '--pwd') {
    setPwd = true;
    setName = false;
    return;
  } else if (setName) {
    name = val;
  } else if (setPwd) {
    pwd = val;
  }
  setName = false;
  setPwd = false;
});

// Application binding
load(path.normalize(path.join(process.cwd(), 'i18n')), null, config.lang)
  .then(() => di(
    'boot',
    extend(
      true,
      default_config.bootstrap,
      config.bootstrap || {}
    ),
    {sysLog: sysLog}
  ))
  .then(scope =>
    di(
      'app',
      di.extract(['auth'], extend(true, default_config.di, config.di, scope.settings.get('plugins') || {})),
      {},
      'boot',
      ['application']
    )
  )
  .then(scope => alias(scope, scope.settings.get('di-alias')))
  .then(scope =>
    new Promise((resolve, reject) => {
      scope.auth.register(
        {
          name: name,
          pwd: pwd
        },
        err => err ? reject(err) : resolve(scope)
      );
    })
  )
  .then(scope => scope.dataSources.disconnect())
  .then(() => {
    console.info(t('User successfully created.'));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(130);
  });
