/**
 * PPTX Executor Service - Execute PptxGenJS code in sandbox
 */

const vm = require('vm');
const pptxgenjs = require('pptxgenjs');
const sharp = require('sharp');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { iconToBase64Png, loadReactIcons } = require('../utils/icons');

// Pre-load react-icons
const reactIcons = loadReactIcons();

/**
 * Execute PptxGenJS code in a sandboxed environment
 * @param {string} code - JavaScript code to execute
 * @param {number} timeout - Execution timeout in ms (default: 60000)
 * @returns {Promise<{success, output, error, execution_time}>}
 */
async function executePptxCode(code, timeout = 60000) {
  const result = {
    success: false,
    output: null,
    error: null,
    execution_time: 0
  };

  const startTime = Date.now();

  try {
    const pres = new pptxgenjs();
    
    const sandbox = {
      pptxgen: pptxgenjs,
      pres: pres,
      PptxGenJS: pptxgenjs,
      iconToBase64Png,
      React,
      ReactDOMServer,
      sharp,
      ...reactIcons,
      console: {
        log: (...args) => { sandbox._logs.push(args.join(' ')); },
        error: (...args) => { sandbox._errors.push(args.join(' ')); },
        warn: (...args) => { sandbox._logs.push('[WARN] ' + args.join(' ')); },
      },
      Buffer,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Promise,
      setTimeout,
      clearTimeout,
      _logs: [],
      _errors: [],
      _result: null,
    };

    vm.createContext(sandbox);

    const wrappedCode = `
      (async () => {
        ${code}
        if (!_result && pres) {
          _result = await pres.write({ outputType: 'base64' });
        }
      })();
    `;

    const script = new vm.Script(wrappedCode, { timeout });
    const promise = script.runInContext(sandbox);
    
    await Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Execution timed out after ${timeout}ms`)), timeout)
      )
    ]);

    if (sandbox._result) {
      result.success = true;
      result.output = {
        base64: sandbox._result,
        logs: sandbox._logs,
      };
    } else {
      result.error = 'No presentation was generated. Make sure to use pres.write() or assign to _result.';
      result.output = { logs: sandbox._logs };
    }

    if (sandbox._errors.length > 0) {
      result.error = sandbox._errors.join('\n');
    }

  } catch (err) {
    result.error = {
      type: err.constructor.name,
      message: err.message,
      stack: err.stack
    };
  }

  result.execution_time = (Date.now() - startTime) / 1000;
  return result;
}

module.exports = { executePptxCode };
