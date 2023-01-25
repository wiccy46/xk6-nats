import {check} from 'k6';
import { SharedArray } from 'k6/data';
import {Nats} from 'k6/x/nats';

export let options = {
  scenarios: {
    per_vu_scenario: {
      executor: "per-vu-iterations",
      vus: 20,
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
const driverCoefficientsSize = 22372080;

export function setup() {
    console.log("Restoring system...");
    restorer.restoreSystem();

}


export default function () {
    const moduleID = physical_id_array[__VU-1];
    console.log("The module id is " + moduleID);

    subscriber.subBeamInsThenCoefficients(moduleID, (msg) => {
        check(msg, {
          'Is size match': (m) => m.size == driverCoefficientsSize
        })
    });

    // subscriber.subscribeBeamInstances(moduleID, (msg) => {
    //     check(msg, {
    //       'Is expected stream topic': (m) => m.topic == "config.module.AAA-1111.beam-instances",
    //       'Is size match': (m) => m.size > approxBeamInstancesBytes
    //     })
    // });

}

export function teardown() {
    subscriber.close();
    restorer.close()
}
