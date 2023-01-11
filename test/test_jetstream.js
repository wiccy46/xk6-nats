import {check, sleep} from 'k6';
import {Nats} from 'k6/x/nats';

const natsConfig = {
    servers: ['nats://localhost:4222'],
    unsafe: true,
};

const streamConfig = {
    // snake case
    name: "module-status",
    subjects: ["status.module.AAA-1111"],
    max_msgs_per_subject: 1,
    discard: 0,
    storage_type: 1
}

const subscriber = new Nats(natsConfig);
const publisher = new Nats(natsConfig);

export default function () {

    const sub = "status.module.AAA-1111"
    publisher.jetStreamSetup(streamConfig)
    sleep(3)
    publisher.jetStreamPublish(sub, "I am a MD96")

    sleep(1)

    subscriber.jetStreamSubscribe(sub, (msg) => {
        check(msg, {
            'Is expected message': (m) => m.data === "I am a MD96",
            'Is expected stream topic': (m) => m.topic === sub,
       })
    });

    sleep(1)

    subscriber.jetStreamSubscribe(sub, (msg) => {
        check(msg, {
            'Is expected message': (m) => m.data === "I am a MD80S",
            'Is expected stream topic': (m) => m.topic === sub,
       })
    });

    sleep(1)

}

export function teardown() {
    subscriber.close();
    publisher.jetStreamDelete("module-status")
    sleep(1)
    publisher.close();
}
