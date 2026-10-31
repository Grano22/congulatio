export const PRIVACY_UPDATED = '2026-10-31';

export const PRIVACY_CONTROLLER = 'Adrian Blasiak, author of Congulatio';

export const PRIVACY_CONTACT = 'https://github.com/Grano22/congulatio/issues';

export const SUPERVISORY_AUTHORITY = 'President of the Personal Data Protection Office (UODO), ul. Stawki 2, 00-193 Warsaw, Poland — uodo.gov.pl';

export type PrivacySection = { heading: string; items: string[] };

export const PRIVACY_SUMMARY: string[] = [
  'Without an account nothing leaves your device: the tome, settings and portrait stay in this browser’s built-in storage.',
  'With an account, your e-mail, name, portrait and tome are stored with Google Firebase only to sign you in and sync your work.',
  'No ads, no analytics, no tracking cookies, and your data is never sold or shared for marketing.',
  'You can export everything to a file and delete your cloud data or your whole account at any time in Account & storage.',
];

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    heading: 'Who is responsible',
    items: [
      `Data controller: ${PRIVACY_CONTROLLER}.`,
      `Contact for any privacy question or request: ${PRIVACY_CONTACT}.`,
      'Congulatio is a university project and is offered free of charge.',
    ],
  },
  {
    heading: 'Using Congulatio without an account',
    items: [
      'Your tome, its change log, your settings and an optional portrait are stored only in this browser (IndexedDB), and the panel layout in localStorage.',
      'This data never reaches us or anyone else. Clearing the site data in your browser deletes it.',
      'Story AI runs on Chrome’s built-in on-device model; your text is not sent to a server.',
      'This storage is strictly necessary for the app to work, so no consent banner is needed for it.',
    ],
  },
  {
    heading: 'What we process when you sign in',
    items: [
      'Account data in Firebase Authentication: user id, e-mail address, display name, portrait link, sign-in provider (e-mail, Google or anonymous) and sign-in times. An anonymous wanderer has only a random id.',
      'Your tome in Cloud Firestore: one record per soul, dialogue step, bond, routine, interaction and attribute, each marked with your user id, plus its size and save time.',
      'Your profile in Cloud Firestore: display name, portrait location and size.',
      'Your portrait in Cloud Storage for Firebase, cropped and shrunk to 256 px before upload.',
      'Technical data Google needs to run the service, such as IP address and browser details in its security logs.',
    ],
  },
  {
    heading: 'Why and on what legal basis',
    items: [
      'To sign you in, keep your tome in sync across devices and show your storage limit — necessary to provide the service you asked for (GDPR Art. 6(1)(b)).',
      'To keep the service secure and prevent abuse — our legitimate interest (Art. 6(1)(f)).',
      'We do not use your data for advertising, profiling or automated decisions, and we do not sell it.',
    ],
  },
  {
    heading: 'Who processes it for us',
    items: [
      'Google Ireland Limited and Google LLC (Firebase) act as our processor under the Firebase data processing terms.',
      'Data may be processed outside the European Economic Area; such transfers rely on the EU–US Data Privacy Framework and Standard Contractual Clauses.',
      'Security rules make sure only you can read or change your records and portrait.',
    ],
  },
  {
    heading: 'How long we keep it',
    items: [
      'Cloud data is kept while your account exists and is removed when you delete your cloud data or your account.',
      'Copies in this browser stay until you remove them or clear the site data.',
      'Google may keep security logs for a limited time under its own retention rules.',
    ],
  },
  {
    heading: 'Your rights',
    items: [
      'Access and portability: Export tome writes all your work to a JSON file; ask us for your account data.',
      'Rectification: change your name and portrait in Account & storage and edit your tome at any time.',
      'Erasure: Delete cloud data or Delete account in Account & storage, or ask us.',
      'Restriction and objection: contact us and we will respond within one month.',
      `You may lodge a complaint with a supervisory authority: ${SUPERVISORY_AUTHORITY}.`,
    ],
  },
];
