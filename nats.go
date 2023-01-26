package nats

import (
	"crypto/tls"
        "context"
	"fmt"
	"time"

	"github.com/dop251/goja"
	natsio "github.com/nats-io/nats.go"
        mcpb "github.com/holoplot/sw__protocols_generated/go/module-config"
	"go.k6.io/k6/js/common"
	"go.k6.io/k6/js/modules"
        "google.golang.org/protobuf/proto"
)

func init() {
	modules.Register("k6/x/nats", new(RootModule))
}

// RootModule is the global module object type. It is instantiated once per test
// run and will be used to create k6/x/nats module instances for each VU.
type RootModule struct{}

// ModuleInstance represents an instance of the module for every VU.
type Nats struct {
	conn      *natsio.Conn
	vu        modules.VU
	exports   map[string]interface{}
}

// Ensure the interfaces are implemented correctly.
var (
	_ modules.Instance = &Nats{}
	_ modules.Module   = &RootModule{}
)

// NewModuleInstance implements the modules.Module interface and returns
// a new instance for each VU.
func (r *RootModule) NewModuleInstance(vu modules.VU) modules.Instance {
	mi := &Nats{
		vu:      vu,
		exports: make(map[string]interface{}),
	}

	mi.exports["Nats"] = mi.client

	return mi
}

// Exports implements the modules.Instance interface and returns the exports
// of the JS module.
func (mi *Nats) Exports() modules.Exports {
	return modules.Exports{
		Named: mi.exports,
	}
}

func (n *Nats) client(c goja.ConstructorCall) *goja.Object {
	rt := n.vu.Runtime()

	var cfg Configuration
	err := rt.ExportTo(c.Argument(0), &cfg)
	if err != nil {
		common.Throw(rt, fmt.Errorf("Nats constructor expect Configuration as it's argument: %w", err))
	}

	natsOptions := natsio.GetDefaultOptions()
	natsOptions.Servers = cfg.Servers
	if cfg.Unsafe {
		natsOptions.TLSConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
	}
	if cfg.Token != "" {
		natsOptions.Token = cfg.Token
	}

	conn, err := natsOptions.Connect()
	if err != nil {
		common.Throw(rt, err)
	}

	return rt.ToValue(&Nats{
		vu:   n.vu,
		conn: conn,
	}).ToObject(rt)
}

func (n *Nats) Close() {
	if n.conn != nil {
		n.conn.Close()
	}
}

func (n *Nats) Publish(topic, message string) error {
	if n.conn == nil {
		return fmt.Errorf("the connection is not valid")
	}

	return n.conn.Publish(topic, []byte(message))
}

func (n *Nats) Subscribe(topic string, handler MessageHandler) error {
	if n.conn == nil {
		return fmt.Errorf("the connection is not valid")
	}

	_, err := n.conn.Subscribe(topic, func(msg *natsio.Msg) {
		message := Message{
			Data:  string(msg.Data),
			Topic: msg.Subject,
		}
		handler(message)
	})

	return err
}

// Connects to JetStream and creates a new stream or updates it if exists already
func (n *Nats) JetStreamSetup(streamConfig *natsio.StreamConfig) error {
	if n.conn == nil {
		return fmt.Errorf("the connection is not valid")
	}

        js, err := n.conn.JetStream()
        if err != nil {
                return fmt.Errorf("cannot accquire jetstream context %w", err)
        }

        stream, _ := js.StreamInfo(streamConfig.Name)
        if stream == nil {
                _, err = js.AddStream(streamConfig)
        } else {
                _, err = js.UpdateStream(streamConfig)
        }

	return err
}

func (n *Nats) JetStreamDelete(name string) error {
	if n.conn == nil {
		return fmt.Errorf("the connection is not valid")
	}

        js, err := n.conn.JetStream()
        if err != nil {
                return fmt.Errorf("cannot accquire jetstream context %w", err)
        }

        js.DeleteStream(name)

        return err
}


func (n *Nats) JetStreamPublish(topic string, message string) error {
	if n.conn == nil {
		return fmt.Errorf("the connection is not valid")
	}

	js, err := n.conn.JetStream()
        if err != nil {
                return fmt.Errorf("cannot accquire jetstream context %w", err)
        }

        _, err = js.Publish(topic, []byte(message))

        return err
}

func (n *Nats) JetStreamSubscribe(topic string, handler MessageHandler) error {
	if n.conn == nil {
		return fmt.Errorf("the connection is not valid")
	}

	js, err := n.conn.JetStream()
        if err != nil {
                return fmt.Errorf("cannot accquire jetstream context %w", err)
        }

        sub, err := js.Subscribe(topic, func(msg *natsio.Msg) {
		message := Message{
			Data:  string(msg.Data),
			Topic: msg.Subject,
		}
		handler(message)
	})
        
        defer func() {
                if err := sub.Unsubscribe(); err != nil {
                        fmt.Errorf("Error unsubscribing")
		}
        }()

	return err
}


func (n *Nats) Request(subject, data string) (Message, error) {
	if n.conn == nil {
		return Message{}, fmt.Errorf("the connection is not valid")
	}

	msg, err := n.conn.Request(subject, []byte(data), 5*time.Second)
	if err != nil {
		return Message{}, err
	}

	return Message{
		Data:  string(msg.Data),
		Topic: msg.Subject,
	}, nil
}

func (n *Nats) RestoreSystem() error {
        fmt.Printf("Restoring system")
	msg := natsio.NewMsg("request.restore.system")
        ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	_, err := n.conn.RequestMsgWithContext(ctx, msg)
        return err
}


// func (n *Nats) SubscribeBeamInstances(topic string, handler MessageHandler) string {
//         t0 := time.Now()
// 	if n.conn == nil {
//                 return time.Since(t0).String()
// 	}

// 	js, err := n.conn.JetStream()
//         if err != nil {
//                 return time.Since(t0).String()
//         }

//         sub, err := js.Subscribe(topic, func(msg *natsio.Msg) {
//                 beamInstances := mcpb.BeamInstances{}

//                 if err := proto.Unmarshal(msg.Data, &beamInstances); err != nil {
//                         fmt.Errorf("cannot unmarshal beam instances")
// 		}

//                 // Todo for now convert it to string for quick check
//                 // can dump them to json
//                 biStr := protojson.Format(&beamInstances)

// 		message := Message{
//                         Data:  string(biStr),
// 			Topic: msg.Subject,
// 		}
// 		handler(message)
// 	})
//         
//         defer func() {
//                 if err := sub.Unsubscribe(); err != nil {
//                         fmt.Errorf("Error unsubscribing")
// 		}
//         }()

//         return time.Since(t0).String()
// }

func (n *Nats) SubscribeBeamInstances(module string, handler NatsmessageHandler) error {
        topic := fmt.Sprintf("config.module.%s.beam-instances", module)
	if n.conn == nil {
                return fmt.Errorf("Cannot connect")
	}

	js, err := n.conn.JetStream()
        if err != nil {
                return err
        }

        sub, err := js.Subscribe(topic, func(msg *natsio.Msg) {

		message := Natsmsg{
			Topic: msg.Subject,
                        Size: len(msg.Data),
		}
		handler(message)

	})
        
        defer func() {
                if err := sub.Unsubscribe(); err != nil {
                        fmt.Errorf("Error unsubscribing")
		}
        }()
        return err
}

func (n *Nats) SubBeamInsThenCoefficients(module string, handler NatsmessageHandler) int {
        si := 0

	if n.conn == nil {
                fmt.Errorf("Cannot connect")
                return si
	}

	js, err := n.conn.JetStream()
        if err != nil {
                fmt.Errorf("Cannot connect to JetStream")
                return si
        }
        
        bsTopic := fmt.Sprintf("config.module.%s.beam-instances", module)
        sub, err := js.SubscribeSync(bsTopic)
        if err != nil {
                fmt.Errorf("cannot subscribe to topic")
                return si
        }

        msg, err := sub.NextMsg(60 * time.Minute)
        if err != nil {
                fmt.Errorf("wait for beam instances message timeout")
                return si
        }
        

        beamInstances := mcpb.BeamInstances{}


        if err := proto.Unmarshal(msg.Data, &beamInstances); err != nil {
                fmt.Errorf("cannot unmarshal beam instances")
                return si
        }

        dcTopic := fmt.Sprintf("request.get.module.%s.beam-instances-drivers-coefficients", module)

        request := mcpb.GetBeamInstancesDriversCoefficientsRequest{
                BeamInstances: &beamInstances,
        }

        requestData, err := proto.Marshal(&request)

        if err != nil {
                fmt.Errorf("Can't marshal request")
                return si
        }

        respMsg, err := n.conn.Request(dcTopic, requestData, 30*time.Minute)

        si = len(respMsg.Data)
        message := Natsmsg{
                Topic: respMsg.Subject,
                Size: si,
        }
        handler(message)
        
        defer func() {
                if err := sub.Unsubscribe(); err != nil {
                        fmt.Errorf("Error unsubscribing")
		}
        }()
        return si
}

type Configuration struct {
	Servers []string
	Unsafe  bool
	Token   string
}

type Message struct {
	Data  string
	Topic string
        Size int
}

type Natsmsg struct {
        Topic string
        Size  int
}

type MessageHandler func(Message)
type NatsmessageHandler func(Natsmsg)
