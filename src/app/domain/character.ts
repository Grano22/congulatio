import { Sex } from "./characterFeatures";
import { DateTimeString } from "./dataFlow";

export type CharacterHead = {
  eyeColor: string,
  hairColor: string,
}

enum BodyType {
  HumanWoman,
  HumanMan,
}

export type CharacterBody = {
  type: BodyType
}

export type Character = {
  id: string,
  firstName: string,
  lastName: string,
  nickname: string,
  birthDate: DateTimeString,
  sex: Sex,
  breed: string,
  origin: string,
  zodiac: string,
  body: CharacterBody,
};
