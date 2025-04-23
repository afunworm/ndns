import { createSocket } from "dgram";
import dnsPacket from "dns-packet";
import net from "net";
import process from "process";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN?.toLowerCase() || "localhost";
const PORT = Number(process.env.PORT || 53);
const HOST = process.env.HOST || "0.0.0.0";
const TTL = process.env.TTL || 60; // Commitment issues?
const VERSION = "Node DNS v1.0.0";

// Helper: 0‑255 check
const isOctet = (s) => /^\d{1,3}$/.test(s) && +s >= 0 && +s <= 255;

function parseARecord(qname) {
	const suffix = "." + ROOT_DOMAIN;

	if (!qname.endsWith(suffix)) return null;

	const sub = qname.slice(0, -suffix.length).replace(/\.$/, "");

	/**
	 * DASH-STYLE
	 * Find *four consecutive dash‑separated octets* anywhere in the sub‑domain
	 * Accept letters before/after, e.g. "why-are-you-192-168-0-1-reading-this"
	 */
	const dashMatch = sub.match(/(?:^|[.-])((\d{1,3})-(\d{1,3})-(\d{1,3})-(\d{1,3}))(?:[.-]|$)/);
	if (dashMatch) {
		const octets = dashMatch[1].split("-");
		if (octets.every(isOctet)) return octets.join(".");
	}

	/**
	 * DOT-STYLE
	 * Scan labels for four consecutive numeric labels
	 */
	const labels = sub.split(".");
	for (let i = 0; i <= labels.length - 4; i++) {
		const quad = labels.slice(i, i + 4);
		if (quad.every(isOctet)) return quad.join(".");
	}

	return null;
}

function parseAAAARecord(qname) {
	const suffix = "." + ROOT_DOMAIN;

	if (!qname.endsWith(suffix)) return null;

	const sub = qname.slice(0, -suffix.length).replace(/\.$/, "");
	const firstLabel = sub.split(".")[0];
	const candidate = firstLabel.replace(/--/g, "::").split("-").join(":");

	return net.isIP(candidate) === 6 ? candidate : null;
}

function buildTXTResponse(qname, clientIp) {
	const root = ROOT_DOMAIN.toLowerCase();
	const name = qname.toLowerCase();

	if (name === `version.${root}` || name === `version.${root}.`) return VERSION;

	if (name.startsWith(`whoami.`)) return `Your IP is ${clientIp}`;

	return `Served by ${VERSION}`;
}

function handleQuery(server, packet, rinfo) {
	if (!packet.questions?.length) return;

	const q = packet.questions[0];

	// Base response: authoritative, recursion not available
	const resp = {
		id: packet.id,
		type: "response",
		flags: dnsPacket.AUTHORITATIVE_ANSWER,
		questions: [q],
		answers: [],
	};

	q.name = q.name.toLowerCase();

	if (q.type === "A") {
		const ip = parseARecord(q.name);
		if (ip) resp.answers.push({ type: "A", name: q.name, ttl: TTL, data: ip });
	} else if (q.type === "AAAA") {
		const ip6 = parseAAAARecord(q.name);
		if (ip6) resp.answers.push({ type: "AAAA", name: q.name, ttl: TTL, data: ip6 });
	} else if (q.type === "TXT") {
		resp.answers.push({ type: "TXT", name: q.name, ttl: TTL, data: buildTXTResponse(q.name, rinfo.address) });
	}

	// Encode & send even with zero answers, so clients don't time‑out
	const buf = dnsPacket.encode(resp);
	server.send(buf, 0, buf.length, rinfo.port, rinfo.address);

	if (resp.answers.length) {
		console.log(`Answer ${q.type} ${q.name} → ${resp.answers[0].data}`);
	} else {
		console.log(`No data for ${q.type} ${q.name}`);
	}
}

// IPv4 listener
const udp4 = createSocket("udp4");

udp4.on("listening", () => {
	const { address, port } = udp4.address();
	console.log(`IPv4 DNS ready at ${address}:${port} for *.${ROOT_DOMAIN}`);
});

udp4.on("message", (msg, rinfo) => {
	try {
		handleQuery(udp4, dnsPacket.decode(msg), rinfo);
	} catch {
		// Ignore bad packets
	}
});
udp4.bind(PORT, HOST);
