// Hardcoded skill: Kubernetes. Tree of subtopics, lessons, and quizzes.
export type Mastery = "unseen" | "intro" | "practiced" | "shaky" | "mastered";

export const MASTERY_ORDER: Mastery[] = ["unseen", "intro", "practiced", "shaky", "mastered"];

export const MASTERY_LABEL: Record<Mastery, string> = {
  unseen: "Not seen",
  intro: "Introduced",
  practiced: "Practiced",
  shaky: "Shaky",
  mastered: "Mastered",
};

export const MASTERY_VAR: Record<Mastery, string> = {
  unseen: "var(--mastery-unseen)",
  intro: "var(--mastery-intro)",
  practiced: "var(--mastery-practiced)",
  shaky: "var(--mastery-shaky)",
  mastered: "var(--mastery-mastered)",
};

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // index
  explanation: string;
}

export interface SkillNode {
  id: string;
  title: string;
  blurb: string;
  prereqs: string[];
  // graph position (normalized 0..1)
  x: number;
  y: number;
  lesson: string[]; // paragraphs
  quiz: QuizQuestion[];
}

export const SKILL_NAME = "Kubernetes";

const KUBERNETES_NODES: SkillNode[] = [
  {
    id: "pods",
    title: "Pods",
    blurb: "The smallest deployable unit.",
    prereqs: [],
    x: 0.5, y: 0.08,
    lesson: [
      "A Pod is the smallest unit you can schedule in Kubernetes. It wraps one or more containers that share the same network namespace and storage volumes.",
      "Containers in the same Pod can talk to each other on localhost. They live and die together — when a Pod is rescheduled, all of its containers are recreated.",
      "You almost never create raw Pods in production. Instead, higher-level controllers like Deployments produce Pods on your behalf, so they get rescheduled when nodes fail.",
    ],
    quiz: [
      { q: "What is the smallest deployable unit in Kubernetes?", options: ["Container", "Pod", "Node", "Service"], answer: 1, explanation: "A Pod wraps one or more containers and is the unit Kubernetes schedules." },
      { q: "Containers in the same Pod share which of the following?", options: ["CPU only", "Network namespace and volumes", "Nothing", "Process namespace by default"], answer: 1, explanation: "Pods share network and storage; PID namespace sharing is opt-in." },
    ],
  },
  {
    id: "deployments",
    title: "Deployments",
    blurb: "Declarative pod rollout.",
    prereqs: ["pods"],
    x: 0.25, y: 0.32,
    lesson: [
      "A Deployment manages a ReplicaSet, which keeps a desired number of Pod replicas running. You declare the target state and the controller reconciles toward it.",
      "Rolling updates work by spinning up Pods of the new revision while gracefully terminating old ones, bounded by maxSurge and maxUnavailable.",
      "If a rollout goes bad, kubectl rollout undo reverts to the previous ReplicaSet — Deployments keep history for exactly this reason.",
    ],
    quiz: [
      { q: "Which object does a Deployment directly manage?", options: ["Pods", "ReplicaSets", "Nodes", "Services"], answer: 1, explanation: "A Deployment owns a ReplicaSet, which in turn owns Pods." },
      { q: "What controls how many extra Pods can exist during a rolling update?", options: ["maxUnavailable", "maxSurge", "replicas", "minReadySeconds"], answer: 1, explanation: "maxSurge sets the upper bound of extra Pods over the desired count." },
    ],
  },
  {
    id: "services",
    title: "Services",
    blurb: "Stable network identity.",
    prereqs: ["pods"],
    x: 0.75, y: 0.32,
    lesson: [
      "Pods are ephemeral and their IPs change. A Service gives a stable virtual IP and DNS name in front of a set of Pods selected by labels.",
      "ClusterIP is the default — only reachable inside the cluster. NodePort opens a port on every node. LoadBalancer asks the cloud for an external load balancer.",
      "Service-to-Pod routing happens via kube-proxy programming iptables or IPVS rules on each node.",
    ],
    quiz: [
      { q: "How does a Service know which Pods to send traffic to?", options: ["By Pod name", "By label selector", "By node", "By namespace alone"], answer: 1, explanation: "Services use label selectors to build their endpoint list." },
      { q: "Which Service type is reachable only inside the cluster?", options: ["NodePort", "ClusterIP", "LoadBalancer", "ExternalName"], answer: 1, explanation: "ClusterIP is the default and is internal-only." },
    ],
  },
  {
    id: "configmaps",
    title: "ConfigMaps",
    blurb: "Inject configuration.",
    prereqs: ["pods"],
    x: 0.5, y: 0.55,
    lesson: [
      "ConfigMaps decouple configuration from container images. You put non-secret key/value data in a ConfigMap and mount it into Pods as env vars or files.",
      "Mounted as a volume, the values are projected as files and updated in-place when the ConfigMap changes — though your app has to notice. Env vars are snapshotted at Pod start and never refresh.",
      "Use Secrets, not ConfigMaps, for credentials. Secrets are base64-encoded (not encrypted by default) and have stricter access controls.",
    ],
    quiz: [
      { q: "If you mount a ConfigMap as env vars, what happens when you update it?", options: ["The Pod's env vars update live", "The Pod's env vars stay at their original values", "The Pod restarts automatically", "The ConfigMap update is rejected"], answer: 1, explanation: "Env vars are read once at Pod start. Only volume mounts get the projected update." },
      { q: "What should you use to store database passwords?", options: ["ConfigMap", "Secret", "A label", "An annotation"], answer: 1, explanation: "Secrets are the right object for credentials." },
    ],
  },
  {
    id: "ingress",
    title: "Ingress",
    blurb: "HTTP routing into the cluster.",
    prereqs: ["services"],
    x: 0.85, y: 0.6,
    lesson: [
      "An Ingress is a set of HTTP routing rules. It needs an Ingress controller (nginx, Traefik, cloud-native) actually running to translate the rules into real proxy config.",
      "Without a controller, an Ingress object does nothing — a common source of confusion when nothing happens after applying the YAML.",
      "Ingress handles host- and path-based routing, TLS termination, and rewrites — all the things a Service alone cannot.",
    ],
    quiz: [
      { q: "What is required for an Ingress resource to actually route traffic?", options: ["Nothing extra", "An Ingress controller", "A NodePort Service", "A LoadBalancer on every node"], answer: 1, explanation: "The Ingress object is just config; a controller has to implement it." },
    ],
  },
  {
    id: "persistent-volumes",
    title: "Persistent Volumes",
    blurb: "Storage that outlives Pods.",
    prereqs: ["pods"],
    x: 0.15, y: 0.6,
    lesson: [
      "A PersistentVolume (PV) is a piece of storage in the cluster. A PersistentVolumeClaim (PVC) is a request for a chunk of that storage — like a Pod is to a Node, a PVC is to a PV.",
      "Dynamic provisioning means a StorageClass auto-creates a PV when a PVC is filed, so cluster admins don't have to pre-provision volumes.",
      "AccessModes (ReadWriteOnce, ReadOnlyMany, ReadWriteMany) describe how many nodes can mount the volume at once — and not all backends support all modes.",
    ],
    quiz: [
      { q: "What is the relationship between a PVC and a PV?", options: ["A PVC is a request for a PV", "A PV is a request for a PVC", "They are unrelated", "PVCs replace PVs in newer versions"], answer: 0, explanation: "PVCs claim PVs, similar to how Pods claim Node resources." },
    ],
  },
  {
    id: "statefulsets",
    title: "StatefulSets",
    blurb: "Stable identity for stateful apps.",
    prereqs: ["deployments", "persistent-volumes"],
    x: 0.3, y: 0.82,
    lesson: [
      "StatefulSets give Pods stable network identities (pod-0, pod-1, …) and stable per-Pod storage that survives rescheduling.",
      "Use them for databases, message queues, anything where 'who am I' matters. For stateless web apps, Deployments are simpler and cheaper.",
      "Scaling and rolling updates happen one Pod at a time, in order — this is intentional for systems that need to elect leaders or replicate data.",
    ],
    quiz: [
      { q: "When would you reach for a StatefulSet over a Deployment?", options: ["Stateless web servers", "A clustered database needing stable identities", "Cron jobs", "One-off scripts"], answer: 1, explanation: "StatefulSets exist for workloads that care about identity and per-Pod storage." },
    ],
  },
  {
    id: "rbac",
    title: "RBAC",
    blurb: "Who can do what.",
    prereqs: ["services", "configmaps"],
    x: 0.7, y: 0.82,
    lesson: [
      "Role-Based Access Control gates the API. A Role grants verbs (get, list, create, …) on resources within a namespace; a ClusterRole does the same cluster-wide.",
      "A RoleBinding (or ClusterRoleBinding) binds a Role to subjects: users, groups, or — most often — ServiceAccounts.",
      "Default deny is the rule: if no binding grants access, the request is rejected. Audit logs are how you find out what's actually being asked for.",
    ],
    quiz: [
      { q: "What does a RoleBinding do?", options: ["Defines verbs on resources", "Connects a Role to subjects", "Creates a ServiceAccount", "Lists nodes"], answer: 1, explanation: "Roles define permissions; RoleBindings attach them to who gets them." },
    ],
  },
];

const SYSTEM_DESIGN_NODES: SkillNode[] = [
  {
    id: "cap-theorem",
    title: "CAP Theorem",
    blurb: "Pick two: consistency, availability, partition tolerance.",
    prereqs: [],
    x: 0.5, y: 0.08,
    lesson: [
      "CAP says that under a network partition, a distributed system has to choose between consistency (every read sees the latest write) and availability (every request gets a non-error response). Partition tolerance is non-negotiable in real networks.",
      "In practice, systems are tuned along the CP/AP axis. A single-leader SQL replica set leans CP; Dynamo-style stores lean AP and reconcile later.",
      "PACELC extends CAP: even when there's no partition, you trade latency vs. consistency. Most production decisions live here.",
    ],
    quiz: [
      { q: "During a network partition, CAP forces a choice between which two?", options: ["Consistency and Availability", "Latency and Throughput", "Durability and Speed", "Reads and Writes"], answer: 0, explanation: "Partition tolerance is assumed; the live trade-off is C vs. A." },
    ],
  },
  {
    id: "load-balancing",
    title: "Load Balancing",
    blurb: "Spread traffic across replicas.",
    prereqs: ["cap-theorem"],
    x: 0.25, y: 0.34,
    lesson: [
      "A load balancer fans incoming requests across a pool of backends. L4 balancers route on TCP; L7 balancers understand HTTP and can route on path, header, or cookie.",
      "Algorithms range from round robin to least-connections to consistent hashing. Consistent hashing matters when backends own state — it minimizes reshuffling on scale events.",
      "Health checks decide who's in the pool. An aggressive check ejects a flapping node fast; a lax one masks brownouts. Pick the trade-off deliberately.",
    ],
    quiz: [
      { q: "Which algorithm minimizes key reshuffling when a backend is added or removed?", options: ["Round robin", "Least connections", "Consistent hashing", "Random"], answer: 2, explanation: "Consistent hashing keeps most keys on the same backend after topology changes." },
    ],
  },
  {
    id: "caching",
    title: "Caching",
    blurb: "Trade memory for latency.",
    prereqs: ["cap-theorem"],
    x: 0.75, y: 0.34,
    lesson: [
      "Caches sit between clients and slow backends. The hard parts are invalidation and stampedes — when a hot key expires and every request races to recompute it.",
      "Strategies: cache-aside (app fills the cache on miss), write-through (writes go through the cache), write-behind (cache absorbs writes and flushes async). Each has different consistency and durability guarantees.",
      "Eviction policies (LRU, LFU, TinyLFU) decide what to drop. Real systems mix tiers: an in-process cache in front of a shared Redis in front of a database.",
    ],
    quiz: [
      { q: "What problem does a cache stampede describe?", options: ["A cache that won't evict", "Many concurrent recomputes after a hot key expires", "A full memory pool", "A misconfigured TTL of zero"], answer: 1, explanation: "A stampede happens when an expired hot key triggers concurrent backend hits." },
    ],
  },
  {
    id: "database-scaling",
    title: "Database Scaling",
    blurb: "Replication, sharding, partitioning.",
    prereqs: ["load-balancing"],
    x: 0.3, y: 0.62,
    lesson: [
      "Vertical scaling (bigger box) buys time. Horizontal scaling means replication for reads and sharding for writes — and sharding is a one-way door.",
      "Replication lag is real. Read-your-writes consistency requires routing the writer's next read to the leader, or to a sufficiently caught-up replica.",
      "A good shard key spreads load and keeps related rows together. A bad one creates hot shards that everyone wants to query at once.",
    ],
    quiz: [
      { q: "Which scaling strategy partitions data across multiple servers?", options: ["Replication", "Sharding", "Caching", "Connection pooling"], answer: 1, explanation: "Sharding splits the dataset; replication copies it." },
    ],
  },
  {
    id: "message-queues",
    title: "Message Queues",
    blurb: "Decouple producers from consumers.",
    prereqs: ["caching"],
    x: 0.7, y: 0.62,
    lesson: [
      "A message queue lets producers hand off work without waiting for consumers. This buys you backpressure, retries, and a buffer for traffic spikes.",
      "Delivery semantics matter: at-most-once drops on failure, at-least-once may duplicate, exactly-once is expensive and rarely truly exact. Idempotent consumers are usually the right answer.",
      "Queues (work distribution) and logs like Kafka (ordered, replayable) solve different problems. Don't pick by brand — pick by whether consumers need replay.",
    ],
    quiz: [
      { q: "Why design consumers to be idempotent?", options: ["To make them faster", "Because at-least-once delivery can duplicate messages", "To skip authentication", "To reduce memory"], answer: 1, explanation: "At-least-once is the common, practical guarantee — consumers must tolerate duplicates." },
    ],
  },
];

export interface Skill {
  id: string;
  name: string;
  nodes: SkillNode[];
}

export const SKILLS: Skill[] = [
  { id: "kubernetes", name: "Kubernetes", nodes: KUBERNETES_NODES },
  { id: "system-design", name: "System Design", nodes: SYSTEM_DESIGN_NODES },
];

export function getSkill(id: string): Skill {
  return SKILLS.find((s) => s.id === id) ?? SKILLS[0];
}

// All nodes flattened — used by the store for mastery lookups.
export const NODES: SkillNode[] = SKILLS.flatMap((s) => s.nodes);

export function nodeById(id: string) {
  return NODES.find((n) => n.id === id);
}

export function skillForNode(id: string): Skill {
  return SKILLS.find((s) => s.nodes.some((n) => n.id === id)) ?? SKILLS[0];
}
