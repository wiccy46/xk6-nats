import { sleep } from 'k6';
import { SharedArray } from 'k6/data';
import {Nats} from 'k6/x/nats';
import { Trend } from 'k6/metrics';

import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

const coefficientSize = new Trend('coefficient_size');

export let options = {
  thresholds: {
    coefficient_size: ['p(100) == 22372080'],
  },
  scenarios: {
    per_vu_scenario: {
      executor: "per-vu-iterations",
      vus: 20,
      iterations: 1,
      maxDuration: '3000s',
    },
  },
};

const rampUp = [
        { duration: 3, target: 10},
        { duration: 4, target: 16},
        { duration: 2, target: 20},
      ];

function getAssignedDelays(rampUp) {
  let delays = [];
  let prevVus = 0;
  let baseDel = 0;

  for (const stage of rampUp) {
    if (stage.target <= prevVus) {
      throw new Error("Each stage must have a greater target than the previous");
    }
    const step = stage.duration / (stage.target - prevVus);

    for (let j = prevVus; j < stage.target; j++) {
      delays.push((j - prevVus) * step + baseDel);
    }

    prevVus = stage.target;
    baseDel += stage.duration;
  }
  return delays;
}

const rampUpDelays = getAssignedDelays(rampUp);



const natsConfig = {
    servers: ['nats://localhost:54222'],
    unsafe: true,
};

const physical_id_array = new SharedArray('Physical Module ID', function () {
  return JSON.parse(open('../data/physical_ids_studio22.json')).physicalId;
})
const restorer = new Nats(natsConfig);
const subscriber = new Nats(natsConfig);

export function setup() {
  console.log("Restoring system...");
  restorer.restoreSystem();
}

export default function () {
  const moduleID = physical_id_array[__VU-1];
  console.log("Module " + moduleID + " delay for " + rampUpDelays[__VU-1] + "s.");
  sleep(rampUpDelays[__VU]);

  const si = subscriber.subBeamInsThenCoefficients(moduleID);
  coefficientSize.add(si)

}

export function teardown() {
  subscriber.close();
  restorer.close()
}

export function handleSummary(data) {
  return {
    "summary.html": htmlReport(data),
  };
}
