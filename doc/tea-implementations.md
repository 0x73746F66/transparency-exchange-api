![](/images/tealogo.png)

# TEA Implementations

## Open Source clients

| Implementation | Type | Description | Resources |
| --- | --- | --- | --- |
| py-libtea | Client library and CLI | A Python client library and CLI client for TEA. | [GitHub](https://github.com/sbomify/py-libtea) |
| PyPi TEA | Registry bridge | A TEA bridge for accessing Python SBOMs from PyPi (via [PEP 770](https://peps.python.org/pep-0770/)). | [GitHub](https://github.com/sbomify/pypi-tea) |
| ReARM CLI | CLI | The ReARM CLI supports TEA. | [Documentation](https://github.com/relizaio/rearm-cli/blob/main/docs/tea.md)<br>[GitHub](https://github.com/relizaio/rearm-cli) |
| Vulnetix CLI and GitHub Action | CLI and GitHub Action, TEA v0.4.0 consumer and producer | One AGPL-3.0 binary covering SCA, SAST, secrets, IaC, containers and licences. It proves reachability with tree-sitter call graphs, runs malscan over your installed dependency bytes, enforces quality gates, detects suppression drift, imports third party tool reports, scans compiled binaries, and emits an AI-BOM and a post-quantum CBOM. Managed AI Guardrails and Package Firewall, provides Vulnetix KEV and STIX threat intel. Full compliance of TEA Consumer and Producer OpenAPI specs. Drop it into a pre-commit hook or a CI step for hundreds of supported ecosystems and CI/CD solutions. | [Documentation](https://docs.cli.vulnetix.com/docs/cli-reference/tea/)<br>[GitHub](https://github.com/Vulnetix/cli) |

## Open Source Servers

| Implementation | Type | Description | Resources |
| --- | --- | --- | --- |
| Oolong | Server | This project is a lightweight implementation of Transparency Exchange API which uses NestJS framework. | [GitHub](https://github.com/relizaio/oolong) |
| ReARM | Server and platform | ReARM is a Release-Level Supply Chain Evidence Platform. It supports TEA for standardized discovery and retrieval of SBOMs and other security artefacts. | [Documentation](https://docs.rearmhq.com/tea/)<br>[GitHub](https://github.com/relizaio/rearm) |
| sbomify | Server and platform | sbomify is a Software Bill of Materials (SBOM) and document management platform that can be self-hosted or accessed through [app.sbomify.com](https://app.sbomify.com). The platform provides a centralized location to upload and manage your SBOMs and related documentation, allowing you to share them with stakeholders or make them publicly accessible.<br>- Implements the Transparency Exchange API<br>- Standardized SBOM discovery via .well-known/tea endpoints<br>- Enables automated discovery and retrieval of SBOMs across the supply chain | [Documentation](https://sbomify.com/faq/how-do-i-enable-tea-in-sbomify/)<br>[GitHub](https://github.com/sbomify/sbomify) |

## Other implementations

| Implementation | Type | Description | Resources |
| --- | --- | --- | --- |
| CyBeats SBOM Studio (commercial) | Server | Cybeats SBOM Studio centralizes the SBOM lifecycle and product vulnerability monitoring and exposes a CycloneDX Transparency Exchange API endpoint through standardized .well-known/tea discovery, enabling automated distribution of SBOMs and related security artifacts across the supply chain. *Curently for demonstration purposes only. | [Product Details](https://www.cybeats.com/product/sbom-studio)<br>[TEA Endpoint](https://us.sbom.cybeats.com/.well-known/tea) |
| CyBeats SBOM Consumer (commercial) | Consumer | Cybeats SBOM Consumer enables IT teams to configure a vendor TEA domain and automatically discover, retrieve, and import supplier SBOMs into the Consumer instance for validation and continuous risk monitoring. | [Product Details](https://www.cybeats.com/product/sbom-consumer) |
| Vulnetix TEA Explorer | Web GUI, TEA v0.4.0 compatible | TEA Explorer is a TEA v0.4.0 compatible GUI with TEA discovery, showing the API call used to fetch all data shown in the GUI on every page. Access is community by default, and data is only private where a customer chooses to restrict their own. It is part of Vulnetix Resolve, an Application Security Posture Management (ASPM) platform that also delivers Unified Vulnerability Management (UVM), Application Security Orchestration and Correlation (ASOC), Continuous Threat Exposure Management (CTEM) and Risk-Based Vulnerability Management (RBVM) in one place, on top of the DevSecOps scanning (SCA, SAST, secrets, IaC and container) you already run. | [Product Details](https://www.vulnetix.com/features/transparency-exchange) |

If you want to have your implementation listed here, please provide a pull request.
