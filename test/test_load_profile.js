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
  var delays = [];
  var prev_vus = 0;
  var base_del = 0;
  for (let i in rampUp) {
    if (rampUp[i].target < prev_vus) {
      throw new Error ("First stage must has more than 0 targets, then each stage should have bigger target than the previous");
    }

		for (let j = 0; j < rampUp[i].target - prev_vus; j++) {
    	const step = 1 / (rampUp[i].target - prev_vus) * rampUp[i].duration;
      delays.push(j * step + base_del);
		}
    prev_vus = rampUp[i].target;
    base_del += rampUp[i].duration;
  }
  return delays;
}

const rampUpDelays = getAssignedDelays(rampUp);



const natsConfig = {
    servers: ['nats://localhost:54222'],
    unsafe: true,
};

const physical_id_array = new SharedArray('Physical Module ID', function () {
  return JSON.parse(open('../data/physical_ids_output240.json')).physicalId;
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
