'use strict';
/* eslint no-process-exit:off, no-sync:off */
/**
 * Created by krasilneg on 21.03.19.
 */
const dataImporter = require('../lib/import-data');
const config = require('../config'); // TODO

const { di, utils: { errorSetup } } = require('@iondv/core');
const { log: { IonLogger } } = require('@iondv/commons');
const { t, lang, load } = require('@iondv/i18n');

const path = require('path');
const extend = require('extend');

lang(config.lang);
errorSetup();

const alias = di.alias;

var sysLog = new IonLogger(config.log || {});

var params = {
  src: '../in/data',
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

load(path.normalize(path.join(__dirname, '..', 'i18n')), null, config.lang)
  .then(() => di('boot', config.bootstrap, {sysLog: sysLog}, null, ['rtEvents']))
  .then(scope =>
    di(
      'app',
      di.extract(
        ['dbSync', 'metaRepo', 'dataRepo', 'workflows', 'sequenceProvider'],
        extend(true, config.di, scope.settings.get('plugins') || {})
      ),
      {},
      'boot',
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
