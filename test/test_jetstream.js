import {check, sleep} from 'k6';
import {Nats} from 'k6/x/nats';

const natsConfig = {
    servers: ['nats://localhost:4222'],
    unsafe: true,
};

const subscriber = new Nats(natsConfig);

export default function () {
    subscriber.jetstreamsubscribe('foo', (msg) => {
        check(msg, {
            'Is expected message': (m) => m.data === 'i love you',
            'Is expected stream topic': (m) => m.topic === 'foo',
        })
    });
    // subscriber.subscribe('baa', (msg) => {
    //     check(msg, {
    //         'Is expected message': (m) => m.data === 'you or not',
    //         'Is expected topic': (m) => m.topic === 'baa',
    //     })
    // });

    sleep(5)

    // publisher.JetstreamPublish('topic', 'the message');

    // sleep(1)
}

export function teardown() {
    subscriber.close();
}
