var INDENTATION_PREFIX = '  ';

// A BlockExpression compiles an array of expressions down to a JavaScript
// function which returns the value of the last expression.
function BlockExpression(expressions) {
  this.expressions = expressions;
}

BlockExpression.prototype.compile = function() {
  var lines = [];
  for (var i = 0, len = this.expressions.length; i < len; ++i) {
    var expressionCode = this.expressions[i].compile() + ';';
    if (i === this.expressions.length - 1) {
      expressionCode = 'return ' + expressionCode;
    }
    lines.push(indentCode(expressionCode));
  }
  return '(function() {\n' + lines.join('\n') + '\n})()';
};

// A CommandExpression compiles a command down to a JavaScript function call.
function CommandExpression(tokens, lineNumber) {
  if (tokens.length === 0) {
    throw new CompileError('empty command cannot be compiled');
  }
  this.lineNumber = lineNumber;
  this.name = tokens[0];
  this.arguments = tokens.slice(1);
}

CommandExpression.prototype.compile = function() {
  var res = 'runtime.commands[' + this.name.compile() + '](' +
    this.lineNumber;
  for (var i = 0, len = this.arguments.length; i < len; ++i) {
    res += ', ' + this.arguments[i].compile();
  }
  return res + ')';
};

// A CompileError is triggered when compilation fails.
function CompileError(message, line) {
  this.message = message;
  this.line = line || -1;
}

CompileError.prototype.toString = function() {
  return 'line ' + this.line + ': ' + this.message;
};

// A ConditionExpression is a statement which compiles to a boolean expression.
function ConditionExpression(tokens) {
  if (tokens[0] === 'not') {
    tokens = tokens.slice(1);
    this.not = true;
  } else {
    this.not = false;
  }

  this.statements = [];
  for (var i = 0, len = tokens.length; i < len; ++i) {
    this.statements[i] = tokenToExpression(tokens[i]);
  }
}

ConditionExpression.prototype.compile = function() {
  if (this.statements.length === 0) {
    return this.not ? 'false' : 'true';
  } else if (this.statements.length === 1) {
    // The runtime.isEmpty function will check if a value is empty.
    return (this.not ? '' : '!') + 'runtime.isEmpty(' +
      this.statements[0].compile() + ')';
  } else {
    var res = (this.not ? '!' : '') + 'runtime.areAllEqual(';
    for (var i = 0, len = this.statements.length; i < len; ++i) {
      if (i !== 0) {
        res += ', ';
      }
      res += this.statements[i].compile();
    }
    return res + ')';
  }
};

// A ForExpression compiles a for loop down to a JavaScript expression.
function ForExpression(lineNumber, expression, body, variable, index) {
  this.lineNumber = lineNumber;
  this.expression = expression;
  this.body = body;
  this.variable = variable;
  this.index = index;
}

ForExpression.prototype.compile = function() {
  // var list = runtime.elements(...);
  // var result = "";
  var codeBeginning = 'var list = runtime.elements(' +
    this.expression.compile() + ');\nvar result = "";';

  var loopBeginning = 'for (var i = 0, len = list.length; i < len; ++i) {\n';

  var loopBody = [];
  if (this.index) {
    // runtime.commands.set(line#, ..., i);
    loopBody.push('runtime.commands.set(' + this.lineNumber + ', ' +
      this.index.compile() + ', i)');
  }
  if (this.variable) {
    // runtime.command.set(line#, ..., list[i]);
    loopBody.push('runtime.commands.set(' + this.lineNumber + ', ' +
      this.variable.compile(), ', list[i])');
  }
  loopBody.push('result = ' + this.body.compile() + ';');

  var loopCode = indentCode(loopBody.join('\n'));
  var functionBody = codeBeginning + loopBeginning + loopCode +
    '\n}\nreturn result;';

  return '(function() {\n' + indentCode(functionBody) + '\n})()';
};

// An IfExpression compiles to a JavaScript if statement wrapped in a function.
function IfExpression(conditions, branches) {
  this.conditions = conditions;
  this.branches = branches;
}

IfExpression.prototype.compile = function() {
  var res = '(function() {';
  for (var i = 0, len = this.conditions.length; i < len; ++i) {
    var condition = this.conditions[i];
    var branch = this.branches[i];
    var branchCode;
    if (i === 0) {
      branchCode = 'if (' + condition.compile() + ') {\n';
    } else {
      branchCode = '} else if (' + condition.compile() + ') {\n';
    }
    branchCode += indentCode('return ' + branch.compile());
    res += indentCode(branchCode) + '\n'
  }
  return res + indentCode('}') + '})()';
};

// A StringExpression compiles to a JavaScript string.
function StringExpression(str) {
  this.string = str;
}

StringExpression.prototype.compile = function() {
  return JSON.stringify(this.string);
};

// A WhileExpression compiles to a JavaScript while loop.
function WhileExpression(condition, body) {
  this.condition = condition;
  this.body = body;
}

WhileExpression.prototype.compile = function() {
  var loopHeader = 'var result = "";\nwhile (' + this.condition.compile() +
    ') {';
  var loopCode = 'result = ' + this.body.compile() + ';';
  var functionBody = loopHeader + '\n' + indentCode(loopCode) + '\n}\n' +
    'return result;';
  return '(function() {\n' + indentCode(functionBody) + '\n})()';
};

// indentCode adds a level of indentation to a block of code.
function indentCode(code) {
  var lines = code.split('\n');
  for (var i = 0, len = lines.length; i < len; ++i) {
    lines[i] = INDENTATION_PREFIX + lines[i];
  }
  return lines.join('\n');
}

// tokenToExpression generates a StringExpression or CommandExpression from a
// token (which must be a string or array).
function tokenToExpression(token, lineNumber) {
  // The token is either a string or an array.
  if ('string' === typeof token) {
    return new StringExpression(token);
  } else {
    return new CommandExpression(token, lineNumber);
  }
}
