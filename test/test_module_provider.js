import {check, sleep} from 'k6';
import {Nats} from 'k6/x/nats';

const natsConfig = {
    servers: ['nats://localhost:54222'],
    unsafe: true,
};


const restorer = new Nats(natsConfig);
const subscriber = new Nats(natsConfig);
const moduleID = 'AAA-1111'
// const approxBeamInstancesBytes = 18000
const driverCoefficientsSize = 22372080

export default function () {
    restorer.restoreSystem()

    // subscriber.subscribeBeamInstances(moduleID, (msg) => {
    //     console.log(msg.topic)

    //     check(msg, {
    //       'Is expected stream topic': (m) => m.topic == "config.module.AAA-1111.beam-instances",
    //       'Is size match': (m) => m.size > approxBeamInstancesBytes
    //     })

    // });

    // sleep(8)

    subscriber.subBeamInsThenCoefficients(moduleID, (msg) => {
        console.log(msg.topic)

        check(msg, {
          'Is size match': (m) => m.size == driverCoefficientsSize
        })

    });

    sleep(15)

}

export function teardown() {
    subscriber.close();
    restorer.close()
}
