import { sleep } from 'k6';
import { SharedArray } from 'k6/data';
import {Nats} from 'k6/x/nats';
import { Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const coefficientSize = new Trend('coefficient_size');

export let options = {
  thresholds: {
    coefficient_size: ['p(100) == 22372080'],
  },
  scenarios: {
    per_vu_scenario: {
      executor: "per-vu-iterations",
      vus: 5,
      iterations: 1,
      maxDuration: '3000s',
    },
  },
};

const natsConfig = {
    servers: ['nats://localhost:54222'],
    unsafe: true,
};

const physical_id_array = new SharedArray('Physical Module ID', function () {
  return JSON.parse(open('../data/physical_ids_output240.json')).physicalId;
})
const restorer = new Nats(natsConfig);
const subscriber = new Nats(natsConfig);
const maxUptime = 3000  // ms

export function setup() {
  console.log("Restoring system...");
  restorer.restoreSystem();
}

export default function () {
  const moduleID = physical_id_array[__VU-1];
  if (__VU != 0) {
    const delay = randomIntBetween(0, maxUptime) / 1000.;
    console.log("Module " + moduleID + " delay for " + delay + "s.");
    sleep(delay);
  }

  const si = subscriber.subBeamInsThenCoefficients(moduleID);
  coefficientSize.add(si)

}

export function teardown() {
  subscriber.close();
  restorer.close()
}
