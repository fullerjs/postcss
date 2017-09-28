'use strict';
const Transform = require('stream').Transform;
const PostCSS = require('postcss');

const Tool = function(fuller, options) {
  fuller.bind(this);

  const opts = options.postcss;
  this.map = opts.map;
  this.processor = PostCSS(this.loadPlugins(opts.plugins));
};

Tool.prototype = {
  build: function() {
    return new Transform({
      objectMode: true,
      transform: (mat, enc, next) => this.process(mat, err => next(err, mat))
    });
  },

  process: function(mat, next) {
    mat.getContent(content => this.processor
      .process(content.toString(), {
        from: mat.src.path,
        to: mat.dst().path,
        map: this.map
      })
      .then(result => {
        this.processResult(result, mat.id);
        mat.setContent(result.css);
        if (result.map) {
          mat.map = result.map;
        }
        next(null, mat);
      })
      .catch(error => {
        this.processError(error);
        next();
      })
    )
  },

  processResult: function(result, matId) {
    if (result.messages) {
      result.messages.forEach(message => {
        if (message.type === 'dependency') {
          this.addDependencies(message.file, matId);
        }
      });
    }

    result
      .warnings()
      .forEach(warn => this.log(warn.toString()));
  },

  processError: function(error) {
    if ( error.name === 'CssSyntaxError' ) {
      this.error({
        message: error.reason,
        file: error.file,
        line: error.line,
        column: error.column,
        extract: error.showSourceCode()
      });
    } else {
      this.error(error);
    }
  },

  loadPlugins: function(plugins) {
    if (!plugins) {
      throw Error('No postcss plugins are defined');
    }

    return plugins.map( plugin => {
      if (typeof plugin === 'string') {
        return this.require(plugin);
      }

      const name = Object.keys(plugin)[0];
      const module = this.require(name);
      return module(plugin[name]);
    });
  }
};


module.exports = Tool;
