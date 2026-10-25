export type DateString = `${number}-${number}-${number}`;
export type DateTimeString = `${number}-${number}-${number} ${number}:${number}:${number}`;
// Standard ISO 8601 DB format
export type ISODateTimeString = `${number}-${number}-${number}T${number}:${number}:${number}.${number}Z`;
// UUID v4 Type
export type UUID = `${string}-${string}-4${string}-${'8' | '9' | 'a' | 'b' | 'A' | 'B'}${string}-${string}`;
