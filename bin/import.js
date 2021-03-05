#!/usr/bin/env node

/* eslint no-process-exit:off, no-sync:off */
/**
 * Created by kras on 10.07.16.
 */
'use strict';
const path = require('path');
const extend = require('extend');
const fs = require('fs');

const metaImporter = require('../lib/import-meta');

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

var sysLog = new IonLogger(config.log || {});

var params = {
  src: process.cwd(),
  ns: null
};

let setParam = null;

process.argv.forEach(function (val) {
  if (val.substr(0, 2) === '--') {
    setParam = val.substr(2);
  } else if (setParam) {
      params[setParam] = val;
  }
});

load(path.normalize(path.join(process.cwd(), 'i18n')), null, config.lang)
  .then(() => di(
    'boot',
    extend(
      true,
      default_config.bootstrap,
      config.bootstrap
    ),
    { sysLog: sysLog },
  ))
  .then(scope =>
    di(
      'app',
      extend(
        true,
        default_config.di,
        config.di,
        scope.settings.get('plugins') || {}
      ),
      {},
      'boot',
      ['dataSources', 'dbSync', 'metaRepo'],
      ['auth', 'application', 'rtEvents']
    )
  )
  .then(scope => alias(scope, scope.settings.get('di-alias')))
  .then(scope =>
    metaImporter(params.src,
      {
        sync: scope.dbSync,
        metaRepo: scope.metaRepo,
        log: sysLog,
        namespace: params.ns
      }).then(() => scope)
  )
  .then(scope => scope.dataSources.disconnect())
  .then(() => {
    console.info(t('Model import successfully done'));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(130);
  });
