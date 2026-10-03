"""Generate deterministic figures used by the Matplotlib cheat sheet."""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LogNorm, TwoSlopeNorm
from matplotlib.patches import FancyBboxPatch, Rectangle


OUT = Path(__file__).resolve().parents[1] / "assets" / "images" / "matplotlib-cheatsheet"
OUT.mkdir(parents=True, exist_ok=True)

INK = "#1F2937"
BLUE = "#2563EB"
TEAL = "#0F766E"
ORANGE = "#EA580C"
PURPLE = "#7C3AED"
GRID = "#CBD5E1"
PAPER = "#F8FAFC"

plt.rcParams.update(
    {
        "figure.facecolor": PAPER,
        "axes.facecolor": "white",
        "axes.edgecolor": GRID,
        "axes.labelcolor": INK,
        "axes.titlecolor": INK,
        "xtick.color": INK,
        "ytick.color": INK,
        "text.color": INK,
        "font.size": 10,
        "axes.spines.top": False,
        "axes.spines.right": False,
    }
)


def save(fig: plt.Figure, name: str) -> None:
    fig.savefig(OUT / name, dpi=180, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def anatomy() -> None:
    fig = plt.figure(figsize=(10, 6.2), facecolor="#DBEAFE", layout="constrained")
    fig.suptitle("Figure: the top-level container", fontsize=17, fontweight="bold")
    ax = fig.add_subplot()
    x = np.linspace(0, 2 * np.pi, 200)
    line = ax.plot(x, np.sin(x), color=BLUE, lw=2.8, label="Line2D artist")[0]
    ax.scatter([1.2, 3.4, 5.1], np.sin([1.2, 3.4, 5.1]), color=ORANGE, zorder=3, label="PathCollection artist")
    ax.set(title="Axes: the plotting area", xlabel="x label", ylabel="y label", ylim=(-1.35, 1.35))
    ax.grid(alpha=0.3)
    ax.legend(loc="lower left")
    ax.annotate(
        "Annotation artist",
        xy=(1.2, np.sin(1.2)),
        xytext=(2.0, 1.12),
        arrowprops={"arrowstyle": "->", "color": INK},
    )
    ax.text(5.55, -1.17, "Axes patch", ha="right", fontsize=9, color=TEAL)
    fig.text(0.985, 0.015, "FigureCanvas renders this artist tree", ha="right", fontsize=10, color=PURPLE)
    line.set_solid_capstyle("round")
    save(fig, "01-figure-anatomy.png")


def chart_gallery() -> None:
    rng = np.random.default_rng(42)
    fig, axs = plt.subplots(2, 3, figsize=(12, 7), layout="constrained")
    fig.suptitle("Choose the mark that matches the question", fontsize=17, fontweight="bold")

    cats = ["A", "B", "C", "D"]
    axs[0, 0].bar(cats, [7, 11, 5, 9], color=[BLUE, TEAL, ORANGE, PURPLE])
    axs[0, 0].set_title("Compare: bar")
    axs[0, 0].set_ylim(0, 13)

    x = np.arange(12)
    axs[0, 1].plot(x, np.cumsum(rng.normal(0.4, 0.7, 12)), marker="o", color=BLUE)
    axs[0, 1].set_title("Change: line")

    samples = rng.normal(size=800)
    axs[0, 2].hist(samples, bins=22, color=TEAL, alpha=0.85, edgecolor="white")
    axs[0, 2].set_title("Distribution: histogram")

    x = rng.normal(size=120)
    y = 0.7 * x + rng.normal(scale=0.6, size=120)
    axs[1, 0].scatter(x, y, s=30, color=PURPLE, alpha=0.65, edgecolors="none")
    axs[1, 0].set_title("Relationship: scatter")

    matrix = rng.normal(size=(8, 10))
    image = axs[1, 1].imshow(matrix, cmap="RdBu_r", norm=TwoSlopeNorm(vcenter=0), aspect="auto")
    axs[1, 1].set_title("Matrix: image + colorbar")
    fig.colorbar(image, ax=axs[1, 1], shrink=0.72)

    groups = [rng.normal(mu, 0.65, 150) for mu in (0, 1, 2)]
    violin = axs[1, 2].violinplot(groups, showmedians=True)
    for body, color in zip(violin["bodies"], (BLUE, TEAL, ORANGE)):
        body.set_facecolor(color)
        body.set_alpha(0.75)
    axs[1, 2].set_title("Compare distributions: violin")
    axs[1, 2].set_xticks([1, 2, 3], ["A", "B", "C"])

    for ax in axs.flat:
        ax.grid(alpha=0.18)
    save(fig, "02-chart-gallery.png")


def layouts() -> None:
    rng = np.random.default_rng(7)
    fig = plt.figure(figsize=(11, 7), layout="constrained")
    axd = fig.subplot_mosaic([["trend", "trend", "dist"], ["scatter", "table", "dist"]], width_ratios=[1, 1, 0.9])
    fig.suptitle("subplot_mosaic: name panels by meaning", fontsize=17, fontweight="bold")

    x = np.arange(20)
    axd["trend"].plot(x, np.cumsum(rng.normal(size=20)), color=BLUE, lw=2.3)
    axd["trend"].set_title("trend — spans two columns", loc="left")

    a = rng.normal(size=100)
    b = 0.5 * a + rng.normal(scale=0.7, size=100)
    axd["scatter"].scatter(a, b, color=PURPLE, alpha=0.6)
    axd["scatter"].set_title("scatter", loc="left")

    axd["dist"].hist(rng.gamma(2, 1, 500), bins=24, orientation="horizontal", color=TEAL)
    axd["dist"].set_title("distribution\n— spans two rows", loc="left")

    axd["table"].axis("off")
    table = axd["table"].table(
        cellText=[["20", "4.8"], ["100", "0.62"]],
        rowLabels=["Periods", "Samples"],
        colLabels=["n", "summary"],
        loc="center",
        cellLoc="center",
    )
    table.scale(1, 1.5)
    axd["table"].set_title("table", loc="left")
    save(fig, "03-layout-mosaic.png")


def coordinates() -> None:
    fig, ax = plt.subplots(figsize=(10, 5.6), layout="constrained")
    x = np.linspace(0, 10, 200)
    y = np.exp(-0.18 * x) * np.cos(1.5 * x)
    ax.plot(x, y, color=BLUE, lw=2.5)
    ax.axhline(0, color=GRID, lw=1)
    ax.set(title="Annotations live in coordinate systems", xlabel="Data x", ylabel="Data y")
    ax.annotate(
        "data coordinates",
        xy=(4.2, np.exp(-0.18 * 4.2) * np.cos(1.5 * 4.2)),
        xytext=(6.2, 0.65),
        arrowprops={"arrowstyle": "->", "color": ORANGE},
        color=ORANGE,
        fontsize=12,
    )
    ax.text(
        0.03,
        0.93,
        "Axes coordinates: (0, 0) bottom-left → (1, 1) top-right",
        transform=ax.transAxes,
        va="top",
        bbox={"boxstyle": "round,pad=0.4", "facecolor": "#ECFDF5", "edgecolor": TEAL},
    )
    fig.text(0.985, 0.015, "Figure coordinates", ha="right", color=PURPLE, fontsize=11)
    save(fig, "04-coordinate-systems.png")


def colormaps() -> None:
    gradient = np.linspace(0, 1, 256).reshape(1, -1)
    diverging = np.linspace(-1, 1, 256).reshape(1, -1)
    fig, axs = plt.subplots(4, 1, figsize=(10, 5), layout="constrained")
    fig.suptitle("Colormap families encode different meanings", fontsize=17, fontweight="bold")
    for ax, data, cmap, title in [
        (axs[0], gradient, "viridis", "Sequential — ordered magnitude"),
        (axs[1], diverging, "RdBu_r", "Diverging — deviation around a center"),
        (axs[2], gradient, "tab10", "Qualitative — unordered categories"),
        (axs[3], gradient, "twilight", "Cyclic — wrapped values such as phase"),
    ]:
        ax.imshow(data, aspect="auto", cmap=cmap)
        ax.set_title(title, loc="left", fontsize=10)
        ax.set_axis_off()
    save(fig, "05-colormap-families.png")


def normalization() -> None:
    x = np.geomspace(1, 10_000, 220)
    y = np.linspace(-3, 3, 160)
    xx, yy = np.meshgrid(x, y)
    z = np.exp(-(yy**2)) * xx
    fig, axs = plt.subplots(1, 2, figsize=(11, 4.7), layout="constrained")
    fig.suptitle("The same values, different normalization", fontsize=17, fontweight="bold")
    im0 = axs[0].imshow(z, origin="lower", aspect="auto", cmap="viridis")
    axs[0].set_title("Linear normalization")
    fig.colorbar(im0, ax=axs[0])
    im1 = axs[1].imshow(z, origin="lower", aspect="auto", cmap="viridis", norm=LogNorm(vmin=z[z > 0].min(), vmax=z.max()))
    axs[1].set_title("LogNorm reveals smaller values")
    fig.colorbar(im1, ax=axs[1])
    for ax in axs:
        ax.set(xlabel="geometric x index", ylabel="y index")
    save(fig, "06-normalization.png")


def rendering_pipeline() -> None:
    fig, ax = plt.subplots(figsize=(12, 3.2), layout="constrained")
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 3)
    ax.axis("off")
    labels = ["Data", "Artists", "Axes", "Figure", "Canvas", "Renderer", "Screen / file"]
    colors = ["#DBEAFE", "#EDE9FE", "#DCFCE7", "#FFEDD5", "#FCE7F3", "#E0F2FE", "#FEF3C7"]
    xs = np.linspace(0.2, 10.4, len(labels))
    for i, (x, label, color) in enumerate(zip(xs, labels, colors)):
        box = FancyBboxPatch((x, 1.0), 1.35, 0.9, boxstyle="round,pad=0.15", facecolor=color, edgecolor=INK, linewidth=1.2)
        ax.add_patch(box)
        ax.text(x + 0.675, 1.45, label, ha="center", va="center", fontweight="bold", fontsize=9.5)
        if i < len(labels) - 1:
            ax.annotate("", xy=(xs[i + 1] - 0.08, 1.45), xytext=(x + 1.43, 1.45), arrowprops={"arrowstyle": "->", "color": INK})
    ax.text(6, 2.55, "Matplotlib rendering pipeline", ha="center", fontsize=17, fontweight="bold")
    ax.text(6, 0.35, "Frontend objects describe what to draw; the backend decides how and where to draw it.", ha="center", color=PURPLE)
    save(fig, "07-rendering-pipeline.png")


def main() -> None:
    anatomy()
    chart_gallery()
    layouts()
    coordinates()
    colormaps()
    normalization()
    rendering_pipeline()
    print(f"Generated 7 assets in {OUT}")


if __name__ == "__main__":
    main()
