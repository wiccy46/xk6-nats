import {check, sleep} from 'k6';
import {Nats} from 'k6/x/nats';

const natsConfig = {
    servers: ['nats://localhost:54222'],
    unsafe: true,
};


const restorer = new Nats(natsConfig);
const subscriber = new Nats(natsConfig);
const sub = 'config.module.AAA-1111.beam-instances'

export default function () {
    restorer.restoreSystem()
    sleep(3)
    let t = "empty"

    t = subscriber.subscribeBeamInstances(sub, (msg) => {
        // console.log(msg.data);
        console.log('after logging msg.data')

       //  check(msg, {
       //      // 'Is expected message': (m) => m.data === "I am a foo",
       //      'Is expected stream topic': (m) => m.topic === sub,
       // })
    });


    console.log('time took is ' + t)
    sleep(5)

}

export function teardown() {
    subscriber.close();
    restorer.close()
}
