"use client";

import { useEffect, useRef, useState } from "react";

const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun", "deno", "vlt"] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const STORAGE_KEY = "packrun.dev:pm";

function getStoredPm(): PackageManager {
  if (typeof window === "undefined") return "npm";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && PACKAGE_MANAGERS.includes(stored as PackageManager)) {
    return stored as PackageManager;
  }
  return "npm";
}

interface InstallTabsProps {
  packageName: string;
  hasTypes?: boolean;
}

export function InstallTabs({ packageName, hasTypes }: InstallTabsProps) {
  const [pm, setPm] = useState<PackageManager>("npm");
  const [copied, setCopied] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved preferences on mount
  useEffect(() => {
    setPm(getStoredPm());
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Save preference when changed
  const handlePmChange = (manager: PackageManager) => {
    setPm(manager);
    localStorage.setItem(STORAGE_KEY, manager);
    setIsOpen(false);
  };

  const commands = getCommands(pm, packageName, hasTypes, false);

  const handleCopy = async (cmd: string) => {
    await navigator.clipboard.writeText(cmd);
    setCopied(cmd);
    setTimeout(() => setCopied(null), 2000);
  };

  const needsTypes = !hasTypes;

  return (
    <div className="space-y-3">
      {/* Header with label and dropdown */}
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-subtle">install</span>

        <div className="flex items-center gap-2">
          {/* Package manager dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium tracking-wide border border-faint text-muted hover:text-foreground hover:border-subtle transition-all"
            >
              {pm}
              <svg
                className={`w-2.5 h-2.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isOpen && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-background border border-border min-w-[100px]">
                {PACKAGE_MANAGERS.map((manager) => (
                  <button
                    key={manager}
                    onClick={() => handlePmChange(manager)}
                    className={`block w-full text-left px-3 py-2 text-xs font-medium tracking-wide transition-colors ${
                      pm === manager
                        ? "bg-foreground text-background"
                        : "text-muted hover:text-foreground hover:bg-surface"
                    }`}
                  >
                    {manager}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commands */}
      <div className="space-y-1">
        {commands.map((cmd, i) => (
          <div
            key={i}
            onClick={() => handleCopy(cmd.full)}
            className={`group flex items-center justify-between border border-border px-4 py-3 cursor-pointer transition-colors ${
              cmd.muted ? "bg-background" : "bg-surface"
            }`}
          >
            <div className="flex-1 min-w-0 overflow-x-auto">
              <code className="text-sm whitespace-nowrap">
                <span className="text-faint select-none">$ </span>
                {cmd.combined ? (
                  // Combined command display
                  <>
                    <span className="text-muted">{cmd.command}</span>{" "}
                    <span className="text-muted">{cmd.subcommand}</span>{" "}
                    <span className="text-foreground font-bold">{cmd.package}</span>
                    <span className="text-subtle"> {cmd.separator} </span>
                    <span className="text-muted">{cmd.command2}</span>{" "}
                    <span className="text-muted">{cmd.subcommand2}</span>{" "}
                    {cmd.flags2 && <span className="text-subtle">{cmd.flags2} </span>}
                    <span className="text-foreground font-bold">{cmd.package2}</span>
                  </>
                ) : (
                  // Regular command display
                  <>
                    <span className={cmd.muted ? "text-subtle" : "text-muted"}>{cmd.command}</span>{" "}
                    {cmd.subcommand && (
                      <span className={cmd.muted ? "text-subtle" : "text-muted"}>
                        {cmd.subcommand}
                      </span>
                    )}{" "}
                    {cmd.flags && <span className="text-subtle">{cmd.flags} </span>}
                    <span className="text-foreground font-bold">{cmd.package}</span>
                  </>
                )}
              </code>
            </div>
            <span
              className={`text-xs uppercase tracking-wider transition-colors shrink-0 ml-2 ${
                copied === cmd.full ? "text-foreground" : "text-faint group-hover:text-foreground!"
              }`}
            >
              {copied === cmd.full ? "copied" : "copy"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CommandParts {
  full: string;
  command: string;
  subcommand: string;
  flags?: string;
  package: string;
  muted?: boolean;
  // For combined commands
  combined?: boolean;
  separator?: string;
  command2?: string;
  subcommand2?: string;
  flags2?: string;
  package2?: string;
}

function getCommands(
  pm: PackageManager,
  name: string,
  hasTypes?: boolean,
  combine?: boolean,
): CommandParts[] {
  const commands: CommandParts[] = [];
  const typesPackage = `@types/${name.replace("@", "").replace("/", "__")}`;
  const needsTypes = !hasTypes;

  // If combining and needs types, return single combined command
  if (combine && needsTypes) {
    switch (pm) {
      case "npm":
        commands.push({
          full: `npm install ${name} && npm install -D ${typesPackage}`,
          command: "npm",
          subcommand: "install",
          package: name,
          combined: true,
          separator: "&&",
          command2: "npm",
          subcommand2: "install",
          flags2: "-D",
          package2: typesPackage,
        });
        break;
      case "pnpm":
        commands.push({
          full: `pnpm add ${name} && pnpm add -D ${typesPackage}`,
          command: "pnpm",
          subcommand: "add",
          package: name,
          combined: true,
          separator: "&&",
          command2: "pnpm",
          subcommand2: "add",
          flags2: "-D",
          package2: typesPackage,
        });
        break;
      case "yarn":
        commands.push({
          full: `yarn add ${name} && yarn add -D ${typesPackage}`,
          command: "yarn",
          subcommand: "add",
          package: name,
          combined: true,
          separator: "&&",
          command2: "yarn",
          subcommand2: "add",
          flags2: "-D",
          package2: typesPackage,
        });
        break;
      case "bun":
        commands.push({
          full: `bun add ${name} && bun add -d ${typesPackage}`,
          command: "bun",
          subcommand: "add",
          package: name,
          combined: true,
          separator: "&&",
          command2: "bun",
          subcommand2: "add",
          flags2: "-d",
          package2: typesPackage,
        });
        break;
      case "deno":
        // Deno can add both in single command
        commands.push({
          full: `deno add npm:${name} npm:${typesPackage}`,
          command: "deno",
          subcommand: "add",
          package: `npm:${name} npm:${typesPackage}`,
        });
        break;
      case "vlt":
        commands.push({
          full: `vlt install ${name} && vlt install -D ${typesPackage}`,
          command: "vlt",
          subcommand: "install",
          package: name,
          combined: true,
          separator: "&&",
          command2: "vlt",
          subcommand2: "install",
          flags2: "-D",
          package2: typesPackage,
        });
        break;
    }
    return commands;
  }

  // Separate commands (original behavior)
  switch (pm) {
    case "npm":
      commands.push({
        full: `npm install ${name}`,
        command: "npm",
        subcommand: "install",
        package: name,
      });
      break;
    case "pnpm":
      commands.push({
        full: `pnpm add ${name}`,
        command: "pnpm",
        subcommand: "add",
        package: name,
      });
      break;
    case "yarn":
      commands.push({
        full: `yarn add ${name}`,
        command: "yarn",
        subcommand: "add",
        package: name,
      });
      break;
    case "bun":
      commands.push({
        full: `bun add ${name}`,
        command: "bun",
        subcommand: "add",
        package: name,
      });
      break;
    case "deno":
      commands.push({
        full: `deno add npm:${name}`,
        command: "deno",
        subcommand: "add",
        package: `npm:${name}`,
      });
      break;
    case "vlt":
      commands.push({
        full: `vlt install ${name}`,
        command: "vlt",
        subcommand: "install",
        package: name,
      });
      break;
  }

  // Types command if package doesn't have built-in types
  if (needsTypes) {
    switch (pm) {
      case "npm":
        commands.push({
          full: `npm install -D ${typesPackage}`,
          command: "npm",
          subcommand: "install",
          flags: "-D",
          package: typesPackage,
          muted: true,
        });
        break;
      case "pnpm":
        commands.push({
          full: `pnpm add -D ${typesPackage}`,
          command: "pnpm",
          subcommand: "add",
          flags: "-D",
          package: typesPackage,
          muted: true,
        });
        break;
      case "yarn":
        commands.push({
          full: `yarn add -D ${typesPackage}`,
          command: "yarn",
          subcommand: "add",
          flags: "-D",
          package: typesPackage,
          muted: true,
        });
        break;
      case "bun":
        commands.push({
          full: `bun add -d ${typesPackage}`,
          command: "bun",
          subcommand: "add",
          flags: "-d",
          package: typesPackage,
          muted: true,
        });
        break;
      case "deno":
        commands.push({
          full: `deno add npm:${typesPackage}`,
          command: "deno",
          subcommand: "add",
          package: `npm:${typesPackage}`,
          muted: true,
        });
        break;
      case "vlt":
        commands.push({
          full: `vlt install -D ${typesPackage}`,
          command: "vlt",
          subcommand: "install",
          flags: "-D",
          package: typesPackage,
          muted: true,
        });
        break;
    }
  }

  return commands;
}
