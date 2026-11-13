export type HazardGuideName = 'Flood' | 'Landslide' | 'Storm surge';
export type SafetyFigureKind = 'kit' | 'route' | 'higher-ground' | 'floodwater' | 'slope' | 'road' | 'coast' | 'shelter' | 'all-clear' | 'utilities' | 'report';

interface SafetyStep {
  title: string;
  figure: SafetyFigureKind;
  instructions: string[];
}

interface SafetyGuide {
  priority: string;
  phases: { name: 'Before' | 'During' | 'After'; description: string; steps: SafetyStep[] }[];
  sources: { label: string; shortLabel: string; href: string }[];
}

// Adapted from the linked public safety instructions, reviewed 13 November 2026.
// These are general precautions, independent of the assessment's mapped level.
export const HAZARD_SAFETY_GUIDES: Record<HazardGuideName, SafetyGuide> = {
  Flood: {
    priority: 'If flooding threatens, leave early for higher ground. Keep out of floodwater.',
    phases: [
      { name: 'Before', description: 'Prepare while routes are clear.', steps: [
        { title: 'Keep essentials ready', figure: 'kit', instructions: [
          'Pack drinking water, ready-to-eat food, a flashlight, and a radio.',
          'Store supplies and important belongings above likely flood level.',
        ] },
        { title: 'Plan your way out', figure: 'route', instructions: [
          'Agree on an evacuation place and route with your household.',
          'Follow PAGASA updates and your barangay’s instructions.',
        ] },
      ] },
      { name: 'During', description: 'Protect people before belongings.', steps: [
        { title: 'Move to higher ground', figure: 'higher-ground', instructions: [
          'Leave before rising water cuts off your route.',
          'Use a safe route to higher ground; follow evacuation instructions.',
        ] },
        { title: 'Keep out of floodwater', figure: 'floodwater', instructions: [
          'Do not walk, swim, or drive through flooded roads or streams.',
          'Avoid submerged bridges and fallen electrical lines.',
        ] },
      ] },
      { name: 'After', description: 'Hazards can remain after water recedes.', steps: [
        { title: 'Wait for the all-clear', figure: 'all-clear', instructions: [
          'Return only when authorities say the area is safe.',
          'Keep away from damaged homes and blocked roads.',
        ] },
        { title: 'Check before using', figure: 'utilities', instructions: [
          'Have wet wiring and appliances checked by a qualified electrician.',
          'Discard flood-contaminated food; use water confirmed safe to drink.',
        ] },
      ] },
    ],
    sources: [
      { label: 'PAGASA · Flood safety rules', shortLabel: 'PAGASA', href: 'https://www.pagasa.dost.gov.ph/learning-tools/floods' },
      { label: 'NWS · After a flood', shortLabel: 'NWS', href: 'https://www.weather.gov/safety/flood-after' },
    ],
  },
  Landslide: {
    priority: 'Leave when warned of a landslide. Keep clear of slopes and the path of moving debris.',
    phases: [
      { name: 'Before', description: 'Know where to go before a warning.', steps: [
        { title: 'Know a safe evacuation route', figure: 'route', instructions: [
          'Learn the safest route to your designated evacuation site.',
          'Ask your barangay about landslide-prone areas and local warnings.',
        ] },
        { title: 'Be ready to leave', figure: 'kit', instructions: [
          'Prepare your household’s emergency go bag.',
          'Keep emergency contacts and follow weather and local advisories.',
        ] },
      ] },
      { name: 'During', description: 'Act immediately on warnings.', steps: [
        { title: 'Move away from the slide path', figure: 'slope', instructions: [
          'Evacuate immediately when officials warn of a landslide.',
          'If outside, move away from affected slopes and moving debris.',
        ] },
        { title: 'Avoid damaged routes', figure: 'road', instructions: [
          'Do not cross collapsed bridges or roads covered by a slide.',
          'If trapped indoors and unable to evacuate, shelter under a sturdy table.',
        ] },
      ] },
      { name: 'After', description: 'Further slides and flooding are possible.', steps: [
        { title: 'Stay outside the affected area', figure: 'all-clear', instructions: [
          'Wait for officials to allow your return.',
          'Watch for flash floods where debris has blocked streams.',
        ] },
        { title: 'Report hazards and missing people', figure: 'report', instructions: [
          'Tell responders where people may be missing or trapped.',
          'Have damaged buildings and utilities inspected before use.',
        ] },
      ] },
    ],
    sources: [
      { label: 'QCDRRMO · Landslide safety instructions', shortLabel: 'QCDRRMO', href: 'https://quezoncity.gov.ph/qcitizen-guides/what-to-do-in-case-of-landslide/' },
      { label: 'Disaster Preparedness Handbook · Landslides (PDF)', shortLabel: 'Handbook', href: 'https://climate.gov.ph/files/Disaster_Preparedness_First_Aid_Handbook.pdf#page=50' },
    ],
  },
  'Storm surge': {
    priority: 'When advised to evacuate, move inland to safe higher ground. Stay away from the shore.',
    phases: [
      { name: 'Before', description: 'Prepare before a tropical cyclone arrives.', steps: [
        { title: 'Find your evacuation site', figure: 'shelter', instructions: [
          'Know the safest route to higher ground or an LGU-designated shelter.',
          'Arrange a safe place to stay with family or friends if needed.',
        ] },
        { title: 'Pack and monitor warnings', figure: 'kit', instructions: [
          'Keep an emergency kit ready to take with you.',
          'Check PAGASA bulletins and instructions from barangay officials.',
        ] },
      ] },
      { name: 'During', description: 'Evacuate early when instructed.', steps: [
        { title: 'Move inland and higher', figure: 'coast', instructions: [
          'Leave coastal lowlands as soon as officials advise evacuation.',
          'Take your emergency kit and follow the designated safe route.',
        ] },
        { title: 'Stay away from the shore', figure: 'floodwater', instructions: [
          'Keep away from beaches and coastal floodwater.',
          'Do not go to the shore to watch the waves.',
        ] },
      ] },
      { name: 'After', description: 'Stay cautious after the storm passes.', steps: [
        { title: 'Return only when cleared', figure: 'all-clear', instructions: [
          'Remain in your safe location until officials allow return.',
          'Keep checking local news for road and weather updates.',
        ] },
        { title: 'Avoid damaged utilities', figure: 'utilities', instructions: [
          'Stay clear of fallen power lines and flooded roads.',
          'Stay out of damaged buildings or places that smell of gas.',
        ] },
      ] },
    ],
    sources: [
      { label: 'PAGASA · Storm-surge precautions', shortLabel: 'PAGASA', href: 'https://www.pagasa.dost.gov.ph/information/storm-surge' },
      { label: 'NWS · Safety after a tropical cyclone', shortLabel: 'NWS', href: 'https://www.weather.gov/safety/hurricane-after' },
    ],
  },
};
