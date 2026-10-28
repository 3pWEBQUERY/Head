export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const notFound = (what = 'Nicht gefunden') => new HttpError(404, what, 'not_found');
export const forbidden = (msg = 'Dafür fehlt dir die Berechtigung') => new HttpError(403, msg, 'forbidden');
export const unauthorized = () => new HttpError(401, 'Bitte melde dich an', 'unauthorized');
export const badRequest = (msg: string, code = 'bad_request') => new HttpError(400, msg, code);
