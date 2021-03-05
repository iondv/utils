#!/usr/bin/env node

/* eslint no-process-exit:off, no-sync:off */
/**
 * Created by krasilneg on 21.03.19.
 */
'use strict';
const path = require('path');
const extend = require('extend');
const fs = require('fs');

const dataImporter = require('../lib/import-data');

let config_file = process.argv[2] || process.env.ION_CONFIG_PATH || 'config';

config_file = path.isAbsolute(config_file)
  ? config_file
  : path.normalize(path.join(process.cwd(), config_file));

const config = fs.existsSync(config_file) ? require(config_file) : {};

const default_config = require('../config');

const { di } = require('@iondv/core');
const { log: { IonLogger } } = require('@iondv/commons');
const { t, lang, load } = require('@iondv/i18n');

lang(config.lang);

const alias = di.alias;

var sysLog = new IonLogger(config.log || {});

var params = {
  src: path.join(process.cwd(), 'data'),
  ns: null,
  ignoreIntegrityCheck: true
};

let setParam = null;

process.argv.forEach(function (val) {
  if (val === '--ignoreIntegrityCheck') {
    console.warn(t('Data integrity checks are ignored'));
    params.ignoreIntegrityCheck = true;
  } else if (val.substr(0, 2) === '--') {
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
      config.bootstrap || {}
    ),
    {sysLog: sysLog}
  ))
  .then(scope =>
    di(
      'app',
      extend(true, default_config.di, config.di, scope.settings.get('plugins') || {}),
      {},
      'boot',
      ['dataSources', 'dbSync', 'metaRepo', 'dataRepo', 'workflows', 'sequenceProvider'],
      ['auth', 'application']
    )
  )
  .then(scope => alias(scope, scope.settings.get('di-alias')))
  .then(scope =>
    dataImporter(
      params.src,
      {
        metaRepo: scope.metaRepo,
        dataRepo: scope.dataRepo,
        workflows: scope.workflows,
        sequences: scope.sequenceProvider,
        log: sysLog,
        namespace: params.ns,
        ignoreIntegrityCheck: params.ignoreIntegrityCheck
      }).then(() => scope)
  )
  .then(scope => scope.dataSources.disconnect())
  .then(() => {
    console.info(t('Import is successfully done.'));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(130);
  });
