export class HTTPError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HTTPError';
  }
}

export class HTTP400Error extends HTTPError {
  constructor(message: string = 'Bad Request') {
    super(400, message);
    this.name = 'HTTP400Error';
  }
}

export class HTTP401Error extends HTTPError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
    this.name = 'HTTP401Error';
  }
}

export class HTTP403Error extends HTTPError {
  constructor(message: string = 'Forbidden') {
    super(403, message);
    this.name = 'HTTP403Error';
  }
}

export class HTTP404Error extends HTTPError {
  constructor(message: string = 'Not Found') {
    super(404, message);
    this.name = 'HTTP404Error';
  }
}

export class HTTP409Error extends HTTPError {
  constructor(message: string = 'Conflict') {
    super(409, message);
    this.name = 'HTTP409Error';
  }
}

export class HTTP429Error extends HTTPError {
  constructor(message: string = 'Too Many Requests') {
    super(429, message);
    this.name = 'HTTP429Error';
  }
}

export class HTTP500Error extends HTTPError {
  constructor(message: string = 'Internal Server Error') {
    super(500, message);
    this.name = 'HTTP500Error';
  }
}

export class HTTP503Error extends HTTPError {
  constructor(message: string = 'Service Unavailable') {
    super(503, message);
    this.name = 'HTTP503Error';
  }
}
